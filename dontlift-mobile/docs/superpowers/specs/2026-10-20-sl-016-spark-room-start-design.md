# SL-016 Spark Room Start — Design Proposal

**Status:** Approved by the user on 2026-10-20. Implementation is in progress on `feature/sl-016-room-lobby-start`.

## Goal and scope

Implement SL-016's realtime room/member lobby and Host start transition without Cloud Functions or enabling Cloud Billing. Firestore remains the canonical shared state. The app uses authenticated Firebase JS SDK reads/listeners and one online transaction for `WAITING → ACTIVE`.

This proposal does not add lobby-leave mutation, heartbeat, active-session tracking, early exit, vote, Functions deployment, billing, or changes to SL-013/014 transaction contracts. Leaving the lobby only unsubscribes from the current room; the room remains `WAITING` until Host starts it or a later slice defines cleanup.

## `startRoom` contract

The client supplies `version: 1`, UUIDv4 `requestId`, and `roomId`. The authenticated UID is read from Firebase Auth and is never accepted from the request payload.

The client transaction reads the room and the caller's membership before writing. Security Rules require that the caller is the room's `hostId`, has an `ACTIVE` membership with role `HOST`, and that the current room status is `WAITING`. The transaction updates only:

- `status: "ACTIVE"`
- `startedAt: serverTimestamp()`
- `updatedAt: serverTimestamp()`
- `lastStartRequestId: requestId`

Rules require both timestamps to equal `request.time`. The room's `lastStartRequestId` is the durable idempotency marker for its single lifecycle start transition; no separate client-writable receipt document is added. A retry with the same request ID after the transition returns the existing `ACTIVE` outcome. A different request ID against an already `ACTIVE` room returns `failed-precondition`. A concurrent second start observes the committed state after transaction retry and follows the same replay/precondition rules.

The repository returns the committed room ID, `ACTIVE` status, echoed request ID, and authoritative `startedAt` when available from a server read/listener. If the transaction committed but that timestamp read fails, the result must represent the timestamp as pending and retain the request ID so retry/reconciliation cannot start a second transition.

Input validation errors are `invalid-argument`; missing room is `not-found`; a room already started by a different request is `failed-precondition`; missing Auth is `unauthenticated`; Rules rejection for wrong role or an invalid/raced write is `permission-denied`; retryable connectivity/service errors are `unavailable`. Rules remain the authority even when the client performs preflight reads.

## Lobby reads and Rules

Authorized room members may read the room and listen to all room `members` documents ordered by `joinedAt`; SL-016 must not silently truncate Premium rosters with an arbitrary client limit. A user without membership cannot list the roster through a lobby subscription. Existing exact PIN lookup behavior needed by SL-014 remains unchanged. Read usage grows with roster size and reconnects; pagination is deferred unless observed room sizes require it.

Client writes remain denied for member documents, PIN reservations, usage, and command receipts. The only new client room mutation is the exact Host lifecycle update above. Create, delete, participant-count changes, other room fields, and `WAITING → ACTIVE` by a Member/outsider remain denied.

The listener layer owns room/member subscriptions and cancels stale subscriptions when the selected room changes, the screen exits, or auth changes. Reconnect must not duplicate roster entries. UI shows Host-only Start and a waiting state for Members, plus loading, empty, reconnecting, and error states. It must not claim the room is active until the canonical Firestore snapshot reports `ACTIVE`.

## Verification

Use the local Firestore Emulator Suite with authenticated client SDK contexts. Cover allowed Host room/member reads; denied anonymous, outsider, and cross-room reads; denied client mutations to every room/member authority field except the exact start transition; Member/outsider start denial; stale/non-`WAITING` start rejection; duplicate same-ID replay; competing different-ID starts; reconnect without duplicate roster rows; and stale room A snapshots not overwriting room B.

Run existing Rules regression suites plus focused SL-016 tests and TypeScript checks. Do not deploy Rules or Functions to the user's Firebase project. Physical Expo Go two-device lobby behavior remains separate device evidence and must not be inferred from Emulator tests.

## Architecture impact and remaining tradeoffs

This is a narrow exception to ADR-003: `startRoom` becomes a Firestore client transaction guarded by Rules, alongside the existing Spark-specific `createRoom` and `joinRoomByPin` exceptions. Before source changes, update ADR-003 (or add a superseding ADR), `docs/api-contracts.md`, and the SL-016 plan so all three define the same request, fields, errors, replay behavior, and tests.

Firestore Rules cannot return application-specific error codes; some race or authorization failures surface as `permission-denied`. The client must not infer success from a local cache or map ambiguous Rules failures to a more specific result than the evidence supports. Firestore reads/listeners and writes still consume the project's Spark quotas.
