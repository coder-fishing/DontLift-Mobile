# ADR-030: Direct Firestore Sync for Solo Personal History

## Status

Accepted — approved 2026-11-14.

## Context

Completed Solo sessions are useful as personal history across a user’s devices. The app already commits each summary and its outbox event atomically to SQLite. Sending this personal projection through the `syncEvents` Cloud Function adds a Function invocation even though it does not change shared application state.

The owner may submit self-reported summary values. A client can fabricate its own history, so the cloud record cannot be treated as evidence that a sensor observed the device or that a session was completed honestly.

## Decision

- Keep SQLite sessions and `sync_outbox` as the local-first source of truth and retry queue.
- The authenticated client may create its own document at `users/{uid}/sessions/{sessionId}` through a Firestore transaction.
- Firestore Rules permit owner-only reads and validated creates; client updates and deletes remain denied.
- The document keeps the existing Solo History fields: `durationSeconds`, `liftCount`, `violationDurationSeconds`, `penaltyScore`, `startedAt`, `completedAt`, `payloadHash`, and server `createdAt`.
- `sessionId` is the stable document ID. The client computes the legacy canonical event SHA-256 hash so old and new clients agree on identical payloads during rollout. A matching existing hash is idempotent success; a different hash is a permanent conflict and never overwrites the document.
- The new Solo sync worker writes directly to Firestore. The `syncEvents` callable remains available for older app versions during rollout.
- Legacy local Solo failures with `last_error_code = 'not-found'` are requeued once by SQLite migration. Explicit Retry requeues only the matching owner/session failure and claims only that session.
- Solo summaries are personal history only. They must not affect leaderboards, rewards, Premium entitlements, settlement, or canonical group-session data.

## Security and trust boundary

Rules require the signed-in owner, UUID document ID, exact field allowlist, typed non-negative bounded values, consistent duration and penalty arithmetic, ordered timestamps, a lowercase SHA-256 hash shape, and `createdAt == request.time`. Create-only access prevents a client from changing a summary after it exists.

Rules validate shape and ownership, not truthfulness. `payloadHash` supports idempotency and conflict detection; it is not an authenticity proof. No value from this path is authoritative for shared state or rewards.

## Consequences

- Offline completion and local history remain available before sync.
- Each successful sync uses a Firestore transaction with at least one document read and at most one document write. Firestore reads, writes, storage, and bandwidth remain subject to Firestore quotas and pricing.
- Function invocations for new Solo summary syncs are removed, while old app versions remain compatible with the deployed callable.
- Rules deployment is required before clients using direct sync can upload. No Functions change is required.

## Alternatives considered

- Keep Solo summary writes behind `syncEvents`: rejected for new clients because the personal projection does not need a shared-state Function transaction.
- Trust a client-authored summary for leaderboard, billing, Premium, or rewards: rejected because Rules cannot verify device sensor history or roster completeness.
- Replace SQLite outbox with Firestore offline cache: rejected because the app needs explicit retry status, stable local diagnostics, and atomic local summary/outbox commits.

## Source

- Approved design: [`docs/superpowers/specs/2026-11-14-solo-direct-firestore-sync-design.md`](../superpowers/specs/2026-11-14-solo-direct-firestore-sync-design.md)
- Approved implementation plan: [`docs/superpowers/plans/2026-11-14-solo-direct-firestore-sync.md`](../superpowers/plans/2026-11-14-solo-direct-firestore-sync.md)
