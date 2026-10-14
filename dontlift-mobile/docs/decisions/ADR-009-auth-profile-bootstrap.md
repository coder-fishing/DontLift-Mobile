# ADR-009: Registration profile bootstrap và local SQLite projection

## Status

Accepted — human approved 2026-10-06.

## Context

The approved registration journey uses Firebase Authentication Email/Password and requires a Firestore user profile plus a local SQLite profile. The architecture names `completeRegistrationProfile`, but its wire contract and minimum local fields were not defined. A profile bootstrap failure must not falsely enter the authenticated app or make the user create another Auth account.

## Decision

### Callable boundary

Use the authenticated callable contract in `docs/api-contracts.md`. The callable derives UID and email from Firebase Auth; it never trusts a client-supplied UID, email, or password. It creates `users/{uid}` only when absent, initializes `isPremium` to `false`, and never overwrites a previously initialized profile. `isPremium` is server-owned; this canonical casing follows the approved architecture and ADR-007.

The callable uses the common `version`/`requestId` envelope and an atomic server-only command receipt at `users/{uid}/commandReceipts/{requestId}`. Security Rules deny client reads and writes to that receipt path. A repeat with the same request ID and payload returns the prior outcome; a reused ID with a different payload returns `already-exists`.

### Minimum local profile

Create one SQLite table, `local_profiles`, with these columns:

| Column | SQLite type | Constraint / source |
|---|---|---|
| `uid` | `TEXT` | Primary key; Firebase Auth UID |
| `email` | `TEXT` | Not null; returned by the server profile bootstrap |
| `display_name` | `TEXT` | Not null; canonical trimmed profile name |
| `created_at_utc_ms` | `INTEGER` | Not null; server profile creation timestamp |

The local row is a cache/projection keyed by UID. Firebase Auth owns identity/session persistence; the authenticated server profile is authoritative for profile data. This table does not contain a password, ID token, refresh token, or premium entitlement. General settings, sessions, violations, and outbox records are outside this table and this decision.

### Registration and recovery order

1. Validate the form locally; trim the display name and enforce the 1–40 Unicode code-point limit.
2. Create the Firebase Auth account. Set the Auth user's display name before profile bootstrap so a restored session can resume the completion flow.
3. Call `completeRegistrationProfile` and accept only its canonical response.
4. Upsert `local_profiles` in a SQLite transaction.
5. Enter authenticated app content only after profile bootstrap and local upsert succeed.

If the callable fails, keep the authenticated user in a retryable profile-completion state. After restart, native Firebase Auth restores the user; retry bootstrap from the Auth user's display name. If it is missing, ask the user to complete the name field. If SQLite fails after callable success, retry the idempotent callable and local upsert. Never copy Firebase tokens into SQLite, AsyncStorage, or Expo SecureStore.

## Consequences

- Profile bootstrap is a distinct server boundary and can be tested independently of UI.
- The client can recover when Auth account creation succeeds but profile initialization is interrupted.
- The SQLite profile is intentionally small; it is not a general database schema.
- The display-name limit is explicit and must be enforced on both client and server.
- New local database migrations remain part of the implementation and verification plan.
