# DontLift Admin Permissions and Access Lifecycle

Date: 2026-11-24. Status: Proposed enforcement design; UID-based custom-claim provisioning is owner-confirmed. No claims or account states have been changed.

## 1. Permission authority

Use Firebase Auth from the same authorized project as DontLift Mobile. An admin is an authenticated, enabled, non-revoked Firebase account with the boolean custom claim `admin: true`.

The MVP has one admin role shared by approximately 1–2 accounts. A Firestore `role` field, email suffix, route visibility, submitted actor UID, or browser-local flag cannot confer privileges. Do not expose a public admin registration or grant-role endpoint.

Role lifecycle operations are performed only by trusted operator tooling. Ordinary admins cannot grant/revoke roles or manage other admins through the MVP UI.

## 2. Access matrix

| Operation | Unauthenticated | Ordinary mobile account | Authorized admin | Trusted operator tool |
|---|---|---|---|---|
| View public sign-in shell | Allow | Allow | Allow | Not applicable |
| Read own mobile profile | Existing mobile policy | Existing mobile policy | Existing mobile policy | Outside dashboard scope |
| Read admin identity/overview | Deny | Deny | Allow | Not a dashboard session |
| List/inspect users and orders | Deny | Deny | Allow | Not a dashboard session |
| Read revenue/catalog through admin API | Deny | Deny | Allow | Not a dashboard session |
| Disable/re-enable ordinary user | Deny | Deny | Allow with target checks and audit | Outside this tool's role-management scope |
| Disable self or any admin via dashboard | Deny | Deny | Deny | Not a dashboard operation |
| Update existing package price | Deny | Deny | Allow through authorized Express owner | Not a dashboard session |
| Grant/revoke admin claim | Deny | Deny | Deny through dashboard | Allow with trusted credentials and operator record |
| Grant Premium or alter payment receipt | Deny | Deny | Deny | Not provided by the admin provisioning tool |
| Delete users/change package duration | Deny | Deny | Deny in MVP | Not provided by the admin provisioning tool |

The existing mobile package-list endpoint is outside this matrix; do not remove existing catalog access required by checkout. Existing mobile permissions are not broadened by the admin claim.

## 3. Request enforcement

Every Next.js admin handler must:

1. Extract exactly one supported Bearer token from the Authorization header; reject absent/malformed credentials.
2. Verify it with the configured project's Firebase Admin SDK using revocation checking (`verifyIdToken(token, true)`). Reject expired, invalid, revoked, or disabled credentials.
3. Require `decoded.admin === true`; strings or other truthy values do not qualify.
4. Establish actor UID from the verified token, never request body/query/header role assertions.
5. Validate the operation, target restrictions, input, and mutation preconditions.
6. Perform the authorized service action and return a selected DTO with private/no-store caching.

No data repository access or user-existence disclosure happens before authorization. A frontend claim check, middleware/proxy redirect, or protected layout does not replace the handler guard. Server service entry points must require validated actor context so future adapters cannot bypass it accidentally.

Express catalog management independently performs the same identity/admin checks on the forwarded Firebase token. The existing identity-only middleware does not establish admin authorization, even though the current Firebase provider verifies tokens with revocation checking. Do not alter the owner-only semantics of existing mobile order endpoints to serve dashboard-wide queries.

### Error behavior

| Condition | Response |
|---|---|
| Missing/malformed/expired/invalid/revoked token or disabled caller | 401, without sensitive account details |
| Valid token without boolean admin claim | 403 |
| Admin targets self/another admin for account-status mutation | 403 |
| Authorized caller supplies invalid fields | 400 |
| Resource not found after caller authorization | 404 |
| Revision or command-payload conflict | 409 |
| Request throttled | 429 |
| Verification service/dependency unavailable | Sanitized 503 or appropriate 5xx; never grant access |

## 4. First-admin provisioning

Proposed operator workflow, not a script already implemented:

1. Choose/create a Firebase Auth account in the intended project. Confirm its UID, identity, enabled status, and the explicit target project.
2. Run the provisioning tool with trusted server credentials, explicit project ID, and exact UID. Display only the necessary target identity and current claim state for review; never print credentials/tokens.
3. Fetch current custom claims and merge the boolean `admin: true` while preserving unrelated claims. Firebase claim assignment replaces the claim map; do not overwrite unrelated claims accidentally.
4. Serialize operator claim writes. Fetch-and-merge is not an atomic compare-and-swap; parallel claim writers can overwrite one another.
5. Read back the assigned claim and write an operator record containing actor/operator identity, target UID, project, action, timestamp, and outcome. An operator record failure must not be reported as though the claim rolled back.
6. Have the target sign in again or force an ID-token refresh through Firebase SDK. The old token does not gain the new claim automatically before refresh.
7. Confirm `/api/admin/me` succeeds for the intended account and fails for a normal mobile account.

Prefer a distinct operator credential/environment rather than giving a browser or general UI an unrestricted role-management interface. Select actual IAM permissions against Firebase documentation during implementation; do not assume role restrictions in application code constrain the underlying privileged credential.

## 5. Revoking admin access

1. Read the target's current custom claims and remove only `admin`, preserving other claims; serialize claim writes.
2. Revoke refresh tokens for the target. Removing a claim alone does not invalidate existing ID tokens containing the previous claim.
3. Verify claim removal and revocation metadata; record both operations and any partial failure. If revocation fails after claim removal, existing tokens may still contain admin privileges; report incomplete revocation and retry/reconcile before declaring success.
4. Verify that old admin credentials are rejected on the next server request after revocation takes effect, and freshly authenticated credentials have no admin access.
5. Clear dashboard data on 401/403 and return to the appropriate sign-in/permission-denied screen.

The server does not cancel a request already authorized before revocation; its operation may complete. Provider propagation and same-second timing must be tested. Do not promise instantaneous cancellation of in-flight work.

Losing access to all admins is recovered through trusted operator provisioning, not a public emergency endpoint. The MVP dashboard cannot disable itself or another admin; the operator must deliberately revoke an admin role before treating that identity as an ordinary user.

## 6. Managing ordinary user accounts

### Disable

- Authorize actor and inspect the target's current Auth identity/claims.
- Deny self-targeting and targets with admin authority. Recheck target classification immediately before mutation; concurrent role provisioning must not be run against active status commands. Firebase Auth has no cross-operation transaction to make this protection atomic with claim changes.
- Require a reason and an explicit confirmation in the UI; server validation remains mandatory.
- Reserve a durable audit command, apply `disabled: true`, revoke refresh tokens, then mark the command completed only when all required effects are confirmed.
- If disable succeeds but revocation fails, show a partial/needs-reconciliation outcome; do not silently re-enable or claim all effects succeeded.
- Preserve profile, orders, receipts, history, and Premium expiration.

### Re-enable

- Apply the same actor/target/audit protections and set `disabled: false`.
- Do not restore revoked sessions, grant Premium, or change the entitlement expiry. The user signs in again as necessary.
- Repeated commands return their known result. A later enable/disable command must not be mistaken for completion of an older retry; command ordering and per-target concurrency belong in the mutation contract.

### Enforcement boundaries

Revocation-aware admin APIs reject invalidated sessions. Existing mobile direct Firestore access uses its own Rules: the inspected `signedIn`/`isOwner` helpers do not check an account-status document or a revocation timestamp.

Therefore disabling an ordinary account prevents subsequent Auth sign-in/refresh as enforced by Firebase, but does not establish immediate denial for every previously issued token or cached/offline action. Do not label the feature “immediate global ban.” Test and document the window for existing online tokens, offline state, reconnect, and Express requests.

Immediate enforcement across direct mobile data paths would require a separate approved Rules/data-model change and device/emulator testing; it is not silently added to this admin design.

## 7. Package-price authorization

- Only verified admins can submit price updates; the Express endpoint repeats authorization independently of Next.js.
- Only the amount of an existing package may change in the MVP. Reject arbitrary document paths, duration/bonus edits, actor overrides, receipt edits, and unexpected fields.
- Validate expected catalog revision, command identity, amount constraints, and target package in Express, the catalog owner.
- Write canonical command/audit state under the verified actor UID. Next.js logs only a correlation/outcome, not a separate authoritative catalog mutation.
- Preserve pending/reserved order snapshots and require mobile confirmation if a new order price differs from the previously displayed catalog.
- Missing/unavailable backend support leaves this feature disabled with an explicit explanation; never simulate a successful price change locally.

## 8. Browser, credentials, and data boundaries

- Browser Firebase Web configuration is not a privileged credential; Firebase Admin credentials remain server-only.
- Use Firebase SDK-managed token persistence/refresh. Never store bearer tokens in URLs, app tables, hand-written localStorage entries, or application logs.
- For Bearer APIs, accept tokens from Authorization only; do not introduce an implicit cookie-auth fallback. Use same-origin browser calls and a fixed server-side Express origin, not a caller-controlled upstream URL.
- Do not return wildcard cross-origin admin access. Cookie sessions, if later introduced, require a separately designed CSRF/session policy.
- Do not put sensitive data in public HTML/static caches. Clear client query state and cancel/ignore pending responses on logout or loss of privilege.
- Firebase Admin bypasses client Firestore Rules: endpoint/service checks and IAM are the server enforcement boundary. Do not add broad browser access to user/payment collections just because a claim exists.
- Audit should capture necessary actor/target/reason/outcome metadata, not credentials, raw tokens, or unnecessary full user profiles. Retention and authorized audit-reading scope must be finalized before release; no audit-reading UI is assumed in the MVP.

## 9. Acceptance checks

| Scenario | Expected outcome |
|---|---|
| Direct admin API request without token | 401; no data |
| Token from another Firebase project | Rejected; no data |
| Ordinary account with Firestore `role: admin` | 403 |
| Custom claim `admin: "true"` | 403 |
| Valid enabled account with boolean claim | Permitted within operation scope |
| Revoked/disabled admin token | Rejected with revocation-aware verification |
| Fake actor UID in request | Rejected as invalid input or ignored by explicit contract; never changes actor authority |
| Self/other-admin disable | Denied server-side even if UI checks are bypassed |
| Browser calls Express price API directly | Express enforces the same admin checks |
| Duplicate mutation or retry after timeout | Original command outcome is recoverable without duplicate effects |
| Audit intent cannot be saved | No side effect begins |
| Audit completion or revocation fails after a side effect | Partial/uncertain outcome is recorded/reconciled, not fabricated rollback |
| Sign-out while data request is pending | Late result cannot repopulate admin data |
| Another account uses the same browser | No previous admin data returned through application caches |
| Mobile has an existing token when disabled | Actual access window measured and documented; no unsupported immediate-blocking claim |

Use Firebase emulators for suitable local cases, plus staging checks for behaviors not faithfully covered by emulators, including production-style revocation and cross-service integration. These checks are requirements, not completed tests.

## 10. Sources and implementation dependencies

- [PRD](product-requirements.md), [architecture](software-architecture.md), [backend evidence](backend-discovery.md).
- [Firebase custom claims](https://firebase.google.com/docs/auth/admin/custom-claims): assignment through trusted server, overwrite semantics, and token propagation.
- [Firebase session management](https://firebase.google.com/docs/auth/admin/manage-sessions): token lifecycle, revocation, and revocation-aware verification.
- [Next.js authentication](https://nextjs.org/docs/app/guides/authentication): protect data access and endpoint boundaries.
- [Firestore Rules conditions](https://firebase.google.com/docs/firestore/security/rules-conditions): server libraries bypass Rules and use IAM.

Before implementation: finalize command/audit schemas, payload contracts, per-target ordering/recovery, rate limits, operator tool invocation and IAM, actual Auth providers, environment identities, and retention. Dashboard admin-access provisioning itself remains out-of-band.
