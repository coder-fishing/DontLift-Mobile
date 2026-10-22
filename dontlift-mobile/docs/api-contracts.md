# DontLift Firebase Command Contracts

> Runtime update 2026-10-18: [ADR-010](decisions/ADR-010-expo-go-firebase-js.md) replaces native Firebase with Firebase JS SDK / Expo Go and replaces callable registration bootstrap with create-only Firestore Rules. Other planned authoritative commands below remain future work.

> Room-creation update 2026-10-20: [ADR-011](decisions/ADR-011-spark-room-creation.md) replaces the `createRoom` callable with one authenticated Firestore client transaction guarded by Security Rules. This exception is designed for Firebase Spark and does not change the remaining callable contracts.

> Room-start update 2026-10-20: [ADR-013](decisions/ADR-013-spark-room-start.md) adds a narrowly scoped Rules-authorized `startRoom` Firestore transaction for Firebase Spark. It does not add a callable or alter other lifecycle commands.
>
> Stale-room update 2026-10-21: [ADR-019](decisions/ADR-019-spark-stale-room-abort.md) defines foreground Host heartbeat and opportunistic `ACTIVE → ABORTED` transactions on Spark. No scheduled service is used; terminal status converges when a client reconnects.

> Termination-vote update 2026-10-21: [ADR-016](decisions/ADR-016-spark-termination-vote.md) adds Rules-authorized vote transactions for Firebase Spark without Functions or billing.

> Early-exit update 2026-10-20: [ADR-015](decisions/ADR-015-spark-early-exit.md) adds narrowly scoped Rules-authorized transactions for early-exit requests and decisions, plus the per-Member cutoff used by SL-017 violation sync. No Cloud Functions or billing are added.

> Room-completion update 2026-10-21: [ADR-017](decisions/ADR-017-spark-room-completion.md) replaces the `completeRoom` and `acknowledgeMemberSync` callables with narrowly scoped Firestore client transactions on Spark. ACK is a client attestation after draining the local outbox; Rules cannot inspect SQLite.

> Settlement update 2026-10-21: [ADR-020](decisions/ADR-020-spark-settlement-details.md) adds a Host-only settlement-details transaction and member-scoped expiring read on Spark, with no Functions or billing.

> Default bill update 2026-10-22: [ADR-021](decisions/ADR-021-spark-default-bill.md) adds a narrowly scoped Host-calculated bill-share transaction on Spark. Rules authorize Host/lifecycle/schema but do not verify calculation correctness or roster completeness.
>
> Bill override update 2026-10-22: [ADR-022](decisions/ADR-022-spark-bill-overrides.md) adds Host-calculated versioned bill overrides on Spark, locked after the first paid share. Rules authorize revision/state but do not verify calculation correctness or roster completeness.

> **Owner:** Software architecture package  
> **Status:** APPROVED  
> **Wire version:** `1`  
> **Region:** `asia-southeast1`

## 1. Common envelope

Every callable requires Firebase Authentication. Functions derive `actorUid` from the verified ID token and never trust a UID supplied by the client. Rules-authorized Spark transactions, including `createRoom` (§2), `startRoom` (§3), `joinRoomByPin` (§4), termination-vote transactions (§3.2), early-exit transactions (§3.1), room-completion transactions (§5), `calculateBillShares` (§6.2), and `applyBillOverrides` (§6.3), are exceptions defined by their corresponding ADRs.

Every side-effecting request contains:

| Field | Type | Required | Rule |
|---|---|---|---|
| `version` | integer | yes | Must equal `1` |
| `requestId` | UUID string | yes | Idempotency key for the authenticated actor and function |

Every callable success response contains:

| Field | Type | Rule |
|---|---|---|
| `version` | integer | Always `1` |
| `requestId` | UUID string | Echoes the accepted request |
| `serverTimeUtcMs` | integer | Server-observed UTC timestamp |

Rules-authorized Spark transaction results are returned from the committed transaction outcome; server timestamp fields are read from the Firestore snapshot/listener where needed. These transaction results do not claim a separate `serverTimeUtcMs` envelope.

Repeating the same `requestId` with the same canonical payload returns the previous outcome. Reusing it with a different payload returns `already-exists`. Error details contain only stable codes and safe field names; tokens, activation codes, bank details and full emails are never logged or returned in diagnostics.

## 2. `createRoom` — Firestore transaction

The authenticated Expo Go client executes one online Firestore transaction. Security Rules derive the Host from `request.auth.uid` and validate every write in the transaction; the client never has permission to update or delete the resulting room, PIN reservation, usage counter, or receipt. The command is not queued while offline.

**Transaction input**

| Field | Type | Required | Rule |
|---|---|---|---|
| `requestId` | UUID string | yes | Idempotency key at `users/{uid}/commandReceipts/{requestId}` |
| `roomId` | UUID string | yes | Client-generated; immutable after creation |
| `pin` | eight-digit string | yes | Client proposes a PIN; reservation create-only Rules enforce uniqueness; preserve all leading zeros |
| `createdAt` | timestamp | yes | Must use `serverTimestamp()` and equal Security Rules `request.time` |
| `quotaBucketStart` | timestamp | yes | First instant of the current `Asia/Ho_Chi_Minh` calendar month; Rules recompute it from server time |

The app first writes `users/{uid}/roomQuotaClock/current` with a server timestamp and reads it back to choose the bucket. Security Rules validate that probe against `request.time`. The transaction then creates `rooms/{roomId}`, `rooms/{roomId}/members/{uid}`, `roomPins/{pin}`, and `users/{uid}/commandReceipts/{requestId}`, and creates or updates `users/{uid}/usage/current`. That usage document stores `bucketStart`, `count`, `lastRequestId`, and `updatedAt`; the client cannot delete it or move it to another month.

**Result:** After commit, the repository returns the validated room, PIN, `WAITING` state, authenticated Host UID, and the committed server timestamp when it can read it from Firestore. If the read-after-write fails, `createdAt` remains unknown and the local projection is deferred; device time is never substituted. A matching existing receipt returns its saved result; a request-ID collision is rejected. A Free Host may create at most 7 rooms per calendar month. A rejected PIN candidate leaves no partial documents and can be retried.

**Rules obligations:** authenticated owner only; exact field allowlists; Host UID comes from Auth; new PIN is eight decimal digits and reserved only if absent; all cross-document links agree through `getAfter()`; new room starts with `lastJoinRequestId: null`, which Rules use to link a later participant-count update to its receipt; month bucket is derived from server `request.time` shifted by the approved fixed UTC+07:00 calendar; counter increments once or resets to 1 only when the server-derived month changes; count never exceeds 7 for a non-Premium Host; create-only receipt and documents; no update/delete paths for this command.

**Errors:** unauthenticated; permission denied for a failed Rules invariant, including PIN collision; resource exhausted when the current server bucket has reached 7; unavailable for retryable network/service failure; already exists for request-ID collision. The client may pre-check quota for a clear message, but Rules remain authoritative if concurrent creates race. The client never reports success before commit.

## 3. `startRoom` — Firestore transaction (Spark)

The authenticated Expo Go client executes one online Firestore transaction guarded by Security Rules. No UID is accepted from the request. This is the SL-016-only lifecycle exception in [ADR-013](decisions/ADR-013-spark-room-start.md); it does not deploy Cloud Functions or require Cloud Billing.

**Request schema**

| Field | Type | Required | Rule |
|---|---|---|---|
| `version` | integer | yes | `1` |
| `requestId` | UUIDv4 string | yes | Idempotency marker for the room's single start transition |
| `roomId` | UUIDv4 string | yes | Existing room document ID |

The transaction reads `rooms/{roomId}` and `rooms/{roomId}/members/{authenticatedUid}` before writes. Rules require `room.hostId == request.auth.uid`, the membership role/status to be `HOST`/`ACTIVE`, and the current room state to be `WAITING`. The current client changes `status` to `ACTIVE`, sets `startedAt`, `updatedAt`, and `hostHeartbeatAt` to `serverTimestamp()`, and sets `lastStartRequestId` to the request ID. Rules require each supplied timestamp to equal `request.time`; older clients may omit `hostHeartbeatAt`, in which case Rules use `startedAt` as the initial liveness time. Other room fields remain unchanged.

**Replay and concurrency:** `lastStartRequestId` is the durable marker for the room's one start transition. If the room is already `ACTIVE` with the same marker, return the existing outcome. If it is `ACTIVE` with another marker, return `failed-precondition`. Concurrent transactions serialize on the room document; a retry with the same ID receives the committed outcome, while a different ID cannot produce a second transition. No separate command receipt is created.

**Response:** `{ version: 1, requestId, roomId, status: "ACTIVE", startedAtUtcMs }`, where `startedAtUtcMs` is read from the committed server timestamp. If the write committed but its server readback is unavailable, retain the same request ID; the room listener remains authoritative and a retry reconciles the committed state.

**Errors:** `unauthenticated`; `invalid-argument` for malformed IDs/envelope; `not-found` for a missing room; `failed-precondition` for a room already started by a different request; `permission-denied` for wrong role or a Rules-rejected/raced update; `unavailable` for network/service failure. Rules cannot return application-specific error codes, so ambiguous denials remain `permission-denied`. Offline transactions are not queued.

## 3.3 Host heartbeat and stale-room abort — Firestore transactions (Spark)

Resources: `rooms/{roomId}` and `rooms/{roomId}/members/{uid}`. Both operations require a signed-in client and an online Firestore transaction; neither queues offline writes.

`sendHostHeartbeat(roomId)` derives UID from Firebase Auth and requires the caller to be the active Host of an `ACTIVE` room. It updates only `hostHeartbeatAt` and `updatedAt`, both with `serverTimestamp()`. Rules require both values to equal `request.time`. The client reports a heartbeat only after the transaction commits.

`abortStaleRoom(roomId)` is attempted by a connected room member when the liveness cutoff is due, and again on foreground/reconnect. Rules require active or approved-early-exit membership, room status `ACTIVE`, timestamp heartbeat/start values, and `request.time > max(hostHeartbeatAt, startedAt) + 15 minutes`. The transaction writes `status: "ABORTED"`, `endedAt` equal to that exact cutoff, and `updatedAt: serverTimestamp()`. This treats `startedAt` as the liveness timestamp for older app builds that did not refresh the heartbeat during start. A fresh Host heartbeat racing the abort causes the transaction to re-evaluate against the new room document and Rules reject the stale transition.

This is best-effort while clients are online. Spark has no scheduler in this design: if every app is offline/suspended, Firestore remains `ACTIVE` until a client reconnects and runs the check. Local pending violation events are retained at the cutoff but are not synced into the shared score after `ABORTED`.

**Outcomes:** already terminal or not yet stale returns without mutation; unauthenticated/missing room and retryable Firebase failures are surfaced by the client; Rules rejection means the server has not confirmed an abort. Offline transactions are not queued.

## 3.1 Early exit — Firestore transactions (Spark)

Both commands require a signed-in user and a live connection. The authenticated Expo Go client runs the Firestore transaction; the UID is always derived from Firebase Auth. Security Rules check the room, membership, request state and atomic cross-document links. Offline commands are not queued.

### `requestEarlyExit`

| Field | Type | Required | Rule |
|---|---|---|---|
| `version` | integer | yes | `1` |
| `roomId` | UUIDv4 string | yes | Existing ACTIVE room |
| `requestId` | UUIDv4 string | yes | Idempotency key for this request |

The transaction reads the room, the authenticated Member document and `rooms/{roomId}/earlyExitRequests/{memberUid}`. It creates or replaces the request only when the Member is ACTIVE, has not already exited, and has no OPEN request. The document records `version`, `requestId`, `memberUid`, `status`, `requestedAt`, `decision`, `decidedBy`, `decidedAt`, and `cutoffAt`. New requests start OPEN; timestamps use `serverTimestamp()`. Retrying the same ID returns the saved outcome. A new ID may replace a DENIED request; previous attempts are not retained as an audit trail.

### `decideEarlyExit`

| Field | Type | Required | Rule |
|---|---|---|---|
| `version` | integer | yes | `1` |
| `roomId` | UUIDv4 string | yes | Existing ACTIVE room |
| `memberUid` | string | yes | Member who owns the request |
| `requestId` | UUIDv4 string | yes | Must match the current OPEN request |
| `decision` | enum | yes | `APPROVE` or `DENY` |

Only the ACTIVE room Host may decide. The transaction updates the request and, on approval, the Member document atomically. Approval sets request status APPROVED, decision APPROVE, `decidedBy`, `decidedAt`, and `cutoffAt` to the Host UID/server time; it changes membership to EARLY_EXIT and sets `earlyExitAt` to the same server time. Denial sets status DENIED and decision DENY, leaves membership ACTIVE and has no cutoff. Replaying the same decision and request ID returns the committed outcome; a different decision after a terminal result returns `failed-precondition`.

**Response:** `{ version: 1, requestId, roomId, memberUid, status, decision, requestedAtUtcMs, decidedAtUtcMs, cutoffUtcMs }`. Timestamp values may be `null` only while the corresponding server timestamp is unresolved; a successful command is not shown before the transaction commits.

**Errors:** `unauthenticated`, `invalid-argument`, `not-found`, `failed-precondition` for a non-ACTIVE room/member or a non-current request, `permission-denied` for wrong role or a Rules-rejected/raced write, `unavailable` for network/service failure, and `already-exists` for request-ID collision. Offline transactions are not queued.

### Early-exit cutoff and group violation sync

`earlyExitAt` is the authoritative per-Member cutoff. A group violation contributes to score only when its full recorded interval ends at or before this timestamp; equality is eligible. An event ending after the cutoff is kept in the local log and does not change the shared score. A late event ending at or before the cutoff may use the ADR-014 Rules-authorized transaction while the room is ACTIVE, including after the Member status becomes EARLY_EXIT. If the room is terminal, the event remains pending for SL-020 reconciliation. A transaction racing Host approval is re-evaluated against the committed cutoff before it can update score.

## 3.2 Termination vote — Firestore transactions (Spark)

**Resources:** `rooms/{roomId}/terminationVotes/current` and `rooms/{roomId}/terminationVotes/current/ballots/{uid}`.

`openTerminationVote({ version: 1, roomId, requestId })` requires the authenticated user to be an ACTIVE room member. It creates a vote with `voteId == requestId`, `openedByUid`, server `openedAt`, `eligibleVoterCount == rooms.activeMemberCount`, `yesVoteCount: 0`, and `status: "OPEN"`. If an unexpired vote already exists, it returns that vote; a new request may replace an expired vote.

`castTerminationVote({ version: 1, roomId, voteId, requestId, choice: "YES" | "NO" })` requires the caller's ACTIVE membership and an unexpired OPEN vote. It creates one ballot per UID and vote. Replaying the same request returns the saved outcome without incrementing counters; changing a committed choice is rejected. Rules reject ballots when `request.time >= openedAt + 30 seconds`.

The ballot and counters are written atomically. If every eligible member has voted YES, the same transaction sets the vote and room to `CANCELLED` and sets `rooms.endedAt` to server time. A NO keeps the vote open; absent unanimity at expiry, the room remains ACTIVE. Host approval of early exit atomically removes that member from the current unexpired vote denominator and, if applicable, the YES count. If the remaining active members are already unanimous, the room is cancelled in that approval transaction. Expired votes are inert and may be replaced by a later open; no scheduled cleanup or offline command queue is used.

**Responses:** versioned vote snapshot `{ version: 1, roomId, voteId, openedAtUtcMs, eligibleVoterCount, yesVoteCount, status }`; ballot result `{ version: 1, roomId, voteId, requestId, choice, replayed }`.

**Errors:** `unauthenticated`, `invalid-argument`, `not-found`, `failed-precondition` for expired/non-current votes, ineligible members or a changed ballot, `permission-denied` for Rules rejection, and `unavailable` for network/service failure. Neither command queues offline writes.

## 4. `joinRoomByPin`

**Request schema**

| Field | Type | Required | Rule |
|---|---|---|---|
| `version` | integer | yes | `1` |
| `requestId` | UUID string | yes | Common idempotency rule |
| `pin` | string | yes | New invitations use eight digits; existing four-digit invitations remain accepted during migration |

**Response schema:** The original callable common response plus `roomId: UUID`, `status: "WAITING"`, `memberUid: string`, `joinedAtUtcMs: integer`, `alreadyMember: boolean`. Under ADR-012's Spark client exception, the app stores `requestId` in the Firestore receipt and returns the committed room/member metadata after server reads; it does not claim a callable `serverTimeUtcMs` envelope.

**Errors:** `unauthenticated`; `invalid-argument` for malformed PIN; `not-found` for an unknown or expired PIN without room internals; `failed-precondition` when room is not `WAITING`; `permission-denied` from Rules when verified Host capacity does not permit another Member; `unavailable`; `already-exists` for request-ID collision.

**Transaction outputs:** resolve the PIN reservation, validate room/capacity, create membership only when absent, update `participantCount` and store command receipt atomically. The room's `lastJoinRequestId` links the count update to the exact member and receipt written in that transaction; Rules reject another count update once that UID already has membership. Under the Spark client transaction exception (ADR-012), the authenticated client reads one reservation document by PIN; collection listing remains denied. Eight digits reduce guessing probability, but Firestore Rules cannot enforce a read-attempt rate limit, so this lookup is not a complete anti-enumeration control.

## 5. `syncEvents`

**Request schema**

| Field | Type | Required | Rule |
|---|---|---|---|
| `version` | integer | yes | `1` |
| `events` | array | yes | Non-empty bounded batch; client splits and retries after `resource-exhausted` |
| `events[].eventId` | UUID string | yes | Idempotency and destination key |
| `events[].eventType` | enum | yes | `VIOLATION_RECORDED`, `SOLO_SESSION_COMPLETED`, `GROUP_SESSION_LOCAL_SUMMARY` |
| `events[].schemaVersion` | integer | yes | Payload schema version, initially `1` |
| `events[].aggregateType` | string | yes | `SOLO_SESSION`, `GROUP_SESSION` or `ROOM` |
| `events[].aggregateId` | UUID string | yes | Ordering scope |
| `events[].sessionId` | UUID string | yes | Session reference |
| `events[].occurredAtUtcMs` | integer | yes | Device-observed UTC timestamp |
| `events[].payload` | object | yes | Must match `eventType` schema |

`VIOLATION_RECORDED.payload` requires `startedAtUtcMs`, `endedAtUtcMs`, `durationSeconds` and optional `roomId`. Group violations use the Spark transaction in §5.1 rather than this callable. `SOLO_SESSION_COMPLETED.payload` requires `durationSeconds`, `liftCount`, `violationDurationSeconds`, `penaltyScore`, `startedAtUtcMs` and `completedAtUtcMs`. `GROUP_SESSION_LOCAL_SUMMARY.payload` requires `roomId`, `liftCount`, `violationDurationSeconds`, `penaltyScore` and `completedAtUtcMs`.

**Response schema:** `version: 1`, `serverTimeUtcMs`, and one `outcomes[]` item per event with `eventId`, `status: "SYNCED" | "FAILED"`, `retryable: boolean`, optional stable `errorCode`, and optional `destinationRef`.

**Errors:** request-level `unauthenticated`, `invalid-argument`, `resource-exhausted`, `unavailable`. Event-level failures use `permission-denied`, `invalid-argument`, `failed-precondition`, `not-found` or `already-exists`. A transport failure leaves local status `PENDING`; a permanent event failure maps to local `FAILED`.

**Transaction outputs per new event:** validate actor/ownership/session window; read receipt; write destination domain document; update aggregate where applicable; write `users/{uid}/syncReceipts/{eventId}` in one transaction. A matching receipt returns its previous outcome without another domain effect.

### 5.1 Group violation — Firestore transaction on Spark

This boundary is for a single confirmed group violation and does not call `syncEvents` or a Cloud Function. Local capture first commits `violation_logs` and a `sync_outbox` row in one SQLite transaction. The row stays `PENDING` while offline.

| Transaction record | Required fields | Rule |
|---|---|---|
| Room violation document at `rooms/{roomId}/violations/{eventId}` | `eventId`, `actorUid`, `startedAt`, `endedAt`, `durationSeconds`, `createdAt` | `eventId` is UUIDv4 and is also the document ID; actor is the signed-in UID; `createdAt == request.time`; document is immutable. |
| Member aggregate at `rooms/{roomId}/members/{uid}` | Existing member fields plus updated `liftCount`, `violationDurationSeconds`, `penaltyScore`, and `lastViolationEventId` | Only the actor's active membership can change; values must equal the previous aggregate plus this exact event, with `penaltyScore = liftCount * 10 + violationDurationSeconds`. The event ID marker lets Rules verify the atomic event/member linkage. |

The client transaction reads the room, the actor's member document, and the event document before writing. Rules require the room to be `ACTIVE`, the member to be `ACTIVE` or EARLY_EXIT with the event ending no later than `earlyExitAt`, the event interval to start at or after the server `startedAt`, the end to be no later than `request.time`, at least three seconds to have elapsed, and `durationSeconds` to equal the interval floored to whole seconds. Event creation and the exact member aggregate increment must be atomic. Other writes remain denied.

The event document is the idempotency receipt. A retry with the same ID and identical payload returns the committed outcome without another increment. Reusing an ID with different content fails with `already-exists`. If room status is no longer `ACTIVE`, the local event remains `PENDING` for SL-020 reconciliation; it is not permanently failed or written outside this transaction.

Members of the room may read its violation documents. The leaderboard reads room member documents and sorts by ascending `penaltyScore`, then ascending UID for a stable tie. Outsiders and cross-room users remain denied. Firestore listeners provide updates after the transaction commits.

### 5.2 SL-028: GROUP_SESSION_LOCAL_SUMMARY on Spark (ADR-024)

Human approved D4 and the Spark exception on 2026-10-22. This event uses a dedicated Firestore client transaction instead of the syncEvents callable. Owner destination: users/{actorUid}/groupHistory/{roomId}. The command is a personal history projection, never canonical room completion or score authority.

Payload: version 1; UUID eventId; actorUid; UUID roomId; status COMPLETED/CANCELLED/ABORTED/EARLY_EXIT; non-negative safe integer startedAtUtcMs/completedAtUtcMs/liftCount/violationDurationSeconds/penaltyScore. Score equals 10*liftCount+violationDurationSeconds. Millisecond times are projections of the server cutoff/start. The cloud document adds server uploadedAt.

Create-only with owner authorization and ACTIVE/EARLY_EXIT room membership. Rules bind start to room.startedAt, terminal cutoff to room.endedAt, and EARLY_EXIT to the earlier approved member cutoff if present. An active room without an approved exit cannot produce history completion. Owner get/list remains allowed after completion. Updates/deletes and cross-owner reads/writes are denied. Stats are device-reported; Rules cannot prove capture completeness.

Identity: actorUid/roomId with a durable UUID event ID. Write the local summary and matching GROUP_SESSION_LOCAL_SUMMARY outbox in one SQLite transaction after capture/lifecycle draining and cutoff normalization, together with recording completion. Same payload replays without writes; changed payload/event ID under the same room identity fails already-exists. Transient failure retains PENDING; permanent invalid/permission/conflict errors become FAILED and remain explicitly retryable. Local ACK failure does not delete the envelope; replay reads the immutable cloud document before local acknowledgment.

Owner query: completedAtUtcMs DESC, document ID DESC, cursor pair and page size 20. Local/cache merge deduplicates by actor/room and keeps pending local state. Independent startup/reconnect/foreground retry does not depend on the current room or screen. Account changes cancel old callbacks. Second-device recovery includes records already uploaded, not never-uploaded sessions.

Retention: Free UI shows seven days, pending/failed local records remain visible. Local Premium extends local-origin visibility; verified Server Premium extends cloud-origin visibility. This is an application visibility policy, not server-enforced deletion. SL-033 owns purge. No bank account or QR cache. Existing per-room canonical detail permissions and settlement expiry remain unchanged.


## 6. Room completion and reconciliation transactions

### 5.1 `completeRoom`

**Request:** common request plus required `roomId: UUID`.

**Response:** version `1`, echoed `requestId`, `roomId`, `status: "COMPLETED"`, authoritative `endedAtUtcMs`, `reconciliationStatus: "PENDING"`, and `pendingMemberCount`. `pendingMemberUids` are derived by the Host from the room-scoped member listener; the transaction does not query a collection.

**Errors:** `unauthenticated`, `permission-denied`, `not-found`, `failed-precondition` unless room is `ACTIVE` or the same completion request was already committed, `unavailable`, `already-exists` for a reused request ID with conflicting intent.

**Transaction outputs:** the active Host transitions `ACTIVE → COMPLETED`, freezes `endedAt = request.time`, sets `reconciliationStatus = PENDING`, initializes `pendingMemberCount` from the fixed `participantCount`, and stores `completionRequestId`. Repeating the same command reads the stored marker and does not change the result. Early-exit Members remain in the roster count.

### 5.2 `acknowledgeMemberSync`

**Request:** common request plus required `roomId: UUID`. The authenticated member may ACK only after its local outbox contains no PENDING group violation through the room end. The repository checks this before sending; the client does not send a timestamp to claim server verification.

**Response:** common response plus `roomId`, `memberUid`, `reconciliationStatus: "PENDING" | "FINALIZED"`, `pendingMemberCount`, optional `finalizationReason: "ALL_SYNCED"`.

**Errors:** `unauthenticated`, `permission-denied`, `not-found`, `failed-precondition` for an incomplete local flush or wrong room state, `unavailable`, `already-exists` for a reused request ID with conflicting intent.

**Transaction outputs:** atomically update the caller's `syncedThroughAt = room.endedAt` and `syncAcknowledgedAt = request.time`, then decrement the room pending count once. When count reaches zero, the same transaction sets `reconciliationStatus = FINALIZED`, `finalizationReason = ALL_SYNCED`, `finalizedAt = request.time`, and `finalizedBy = request.auth.uid`. Room/member markers link both writes; duplicate delivery cannot decrement twice. Rules reject new violation events after the member ACKs or the room finalizes.

**Spark limit:** Rules cannot inspect SQLite or establish that the device has no additional offline event. The app's local outbox check is best-effort and the ACK is an authenticated member attestation. A modified client could ACK early and omit its own unsynced penalties; eliminating that risk requires a trusted backend, outside this Spark-only slice.

### 5.3 `finalizeRoomScores`

**Request:** common request plus required `roomId: UUID`, `reason: "HOST_OVERRIDE"`, and `confirmedWarning: true`.

**Response:** common response plus `roomId`, `reconciliationStatus: "FINALIZED"`, `finalizationReason: "HOST_OVERRIDE"`, `unsyncedMemberUids`, `auditId` and `scoreSnapshotRef`.

**Errors:** `unauthenticated`, `permission-denied`, `invalid-argument` unless the exact warning was confirmed, `not-found`, `failed-precondition` when already finalized under a different request or no Members remain pending, `unavailable`, `already-exists` for a request-ID collision.

**Spark transaction:** the active Host may finalize a `COMPLETED/PENDING` room only when `pendingMemberCount > 0` and `confirmedWarning` is true. In one online Firestore client transaction, it changes the room to `FINALIZED/HOST_OVERRIDE` and creates an immutable audit at `rooms/{roomId}/reconciliationAudits/{requestId}`. `auditId` is the request ID. The audit records the Host, confirmed-warning attestation, server time, room end time, pending-member count and UIDs observed in the Host's room-member snapshot. `scoreSnapshotRef` identifies the room's member-score documents, which Rules freeze at finalization. Rules link the audit creation and room transition atomically, and reject repeats with a different request ID. Replaying the same request ID returns the saved outcome. The UID list is a Host-observed attestation: Firestore Rules cannot prove that a client-supplied list includes every pending member. No Functions, billing change or offline command queue is used.

After `HOST_OVERRIDE`, eligible late violations are written to room history with `excludedFromFinalScore: true` and `exclusionReason: "HOST_OVERRIDE"`; they never update member score documents. The Host warning is: `Some Members have not synced. Late violations will not affect payment.`

## 7. Bill and settlement callables

### 6.1 `setSettlementDetails` — Spark transaction

This approved SL-023 exception uses the authenticated Firebase client and Firestore Security Rules; it does not call a Cloud Function, require Blaze billing, or use a command receipt.

**Input:** `roomId`, `bankId`, `accountNumber`, `accountName`. The client trims surrounding whitespace. `bankId` must contain 1–32 characters, `accountNumber` 1–64 characters, and `accountName` 1–100 characters. The Host may select a bank from VietQR's public bank directory; when selected, `bankId` stores that bank's six-digit BIN for future QR generation. Manual bank identifiers remain accepted for compatibility.

**Write:** The Host may upsert `rooms/{roomId}/settlementDetails/current` only when the room is `COMPLETED`, reconciliation is `FINALIZED`, and the caller has the active `HOST` membership. Rules require the exact field allowlist, valid bounds, `updatedAt == request.time`, and `expiresAt == room.endedAt + 30 days`. Repeating the same input safely overwrites the same document. There is no separate receipt.

**Read:** Existing room members may read the document while `expiresAt > request.time`; outsiders and cross-room users are denied. A missing document can be read as empty by a room member. Collection listing and client delete remain denied.

**Response:** `version: 1`, `roomId`, and `expiresAtUtcMs`. The client reports success only after the transaction commits. Bank details are never logged, copied to SQLite, or sent to analytics.

**Errors:** `unauthenticated`; `permission-denied` for non-Host writes or non-member reads; `invalid-argument` for malformed fields; `not-found` for a missing room; `failed-precondition` unless the room is `COMPLETED/FINALIZED` or lacks a valid `endedAt`; `unavailable` for transport failure. No offline queue is used.

Expired documents are hidden by Rules but not physically deleted in this slice. Retention/purge is deferred to SL-033 and must not be represented as automatic cleanup here.

### 6.2 `calculateBillShares` — Host-calculated resumable Firestore command (Spark)

The authenticated Host client runs an online, resumable Firestore command under [ADR-021](decisions/ADR-021-spark-default-bill.md). The Host app supplies the UID list observed in the finalized room listener as local transaction input; the client individually rereads those member documents and uses their frozen scores. The list is a Host-client attestation; Rules cannot prove it is complete. The client first creates a room lock and `billPreparations/current` manifest, then writes shares in sequential transactions of at most eight recipients. Rules check each target's membership when its share is created. Staged shares are readable only by the Host. A final transaction publishes room metadata, changes the manifest to `PUBLISHED`, and creates the immutable `billCommands/{requestId}` receipt; Members can read the shares only after this boundary. No offline queue is used.

**Request:** `version: 1`, `requestId: UUID`, `roomId: UUID`, and `totalBillVnd: integer >= 1000`. The Host client derives member scores/eligibility and calculates the per-member result from the transaction's finalized snapshot; callers do not submit UIDs or share values.

**Response:** `{ version: 1, requestId, roomId, totalBillVnd, calculationVersion: 1, shares[], sumShareVnd }`, where each share contains `uid` and `shareVnd`; `sumShareVnd` equals `totalBillVnd`. This Spark response does not claim `serverTimeUtcMs`.

**Errors:** `unauthenticated`, `permission-denied`, `invalid-argument`, `not-found`, `failed-precondition` unless reconciliation is `FINALIZED`, settlement details exist, and no bill has been published; `unavailable`, `already-exists` for request-ID payload collision.

**Transaction outcomes:** the Host client runs the canonical integer rounding/residual algorithm and validates non-negative integer shares and exact sum. It locks the room and records the complete manifest, creates each share once in sequential transactions of at most eight recipients, then atomically sets the room calculation version, publishes the manifest, and stores the immutable room-scoped receipt with request metadata and share UID list. If interrupted, retry resumes the existing preparation using its saved request ID and accepts only the same total and roster. A completed replay reads the receipt and saved shares. Members cannot read staged shares before the final publication transaction. A new request after publication is rejected; SL-024 does not edit or replace a published breakdown.

**Authority limit:** Rules check authenticated Host ownership, finalized room state, settlement-details existence, document ownership, and field shape. They cannot independently recalculate the roster-wide result or prove that all members and scores were included. The published values are Host-authoritative under Spark; do not describe them as server-verified. A same-room Member may read the published breakdown; direct writes by Members and outsiders are denied.

### 6.3 `applyBillOverrides` — versioned Firestore command (Spark)

The authenticated Host client runs the online, in-session retryable command under [ADR-022](decisions/ADR-022-spark-bill-overrides.md). This is a Spark client transaction guarded by Rules, not a callable. The Host supplies a complete roster observation and the proposed override entries; as with SL-024, the roster is a Host attestation and Rules cannot prove completeness or recalculate the amounts.

**Request:** `version: 1`, `requestId: UUIDv4`, `roomId: UUIDv4`, `expectedRevision: non-negative integer`, and a non-empty `overrides[]`. Each entry is `{ uid, type: "FIXED_VND" | "PERCENT_BPS", value }`; value is a non-negative integer and percentage is basis points of the room total, at most 10,000. A fixed value is VND. Entries replace the selected Member's default raw amount; omitted Members keep their default raw amount. The complete raw vector must equal `totalBillVnd` exactly before rounding.

**Transaction outputs:** The client calculates the full vector and applies the same ADR-005 rounding/residual algorithm used by §6.2. It creates a request-specific preparation, stages `billOverrides/{requestId}/shares/{uid}` in sequential transactions of at most eight recipient writes, then atomically changes `billOverrideRequestId`, advances `billRevision`, publishes the manifest, and creates `billOverrideCommands/{requestId}`. The final transaction requires the supplied revision to equal the room's current revision and `billPaidCount` to be zero. A missing revision/count on a default-only or legacy room is treated as 0; SL-024 does not need a schema write. Members can read only the version named by the room pointer; staged and superseded versions remain hidden from Members. Old versions are retained through room expiry, with no physical cleanup promise.

**Response:** `{ version: 1, requestId, roomId, expectedRevision, billRevision, totalBillVnd, calculationVersion: 1, overrideApplied: true, shares[], sumShareVnd }`. The response does not claim `serverTimeUtcMs`.

**Replay and concurrency:** Same request ID and canonical payload returns the committed receipt and shares; a different payload under the same ID returns `already-exists`. Competing requests based on the same revision cannot both switch the room pointer. The live app session retains the request ID for retry after an ambiguous response. Commands are not queued offline; pending request identity is not persisted across app restarts.

**Errors:** `unauthenticated`, `permission-denied` for a non-Host or Rules rejection, `invalid-argument` for malformed/duplicate entries or invalid values, `not-found`, `failed-precondition` for a stale revision, paid bill, non-finalized room, expired settlement details, or vector that does not exactly represent the bill, `unavailable`, and `already-exists` for request-ID payload collision.

**Authority limit:** Rules check authenticated Host ownership, finalized room state, settlement expiry, membership per staged share, paid state, and revision transition. They do not verify override math or roster completeness. Values remain Host-attested under Spark.

### 6.4 `markBillSharePaid` — Spark exception (ADR-023)

**Request:** `version: 1`, UUID `requestId`, UUID `roomId`, `memberUid`, `targetStatus: "MARKED_AS_PAID"`, UUID `publicationRequestId`, non-negative integer `expectedRevision`.

**Response:** request fields plus `actorUid`, positive integer `shareVnd`, and `paidAtUtcMs: number | null`. Null means commit succeeded but server timestamp readback is pending. No device-time or serverTime envelope is fabricated.

**Authority:** actual room Host with ACTIVE HOST membership; COMPLETED/FINALIZED room, calculationVersion 1, unexpired settlement details, ACTIVE/EARLY_EXIT target with positive current share. Resolve default/override path from the room pointer and reject stale publication/revision.

**Atomic outputs:** share gains paymentStatus, server paidAt, paidBy, paymentRequestId; room increments billPaidCount and sets lastPaymentRequestId; immutable billPaymentCommands/requestId records command, actorUid, shareVnd and server paidAt. Share amount and identity remain unchanged. Rules require all three changes and a newly created receipt. The first mark locks overrides. Zero shares are No payment due without a paid write.

**Replay/errors:** matching Host receipt returns prior success before live readiness checks; changed payload is already-exists. New request for paid share or stale version is failed-precondition. Other errors: unauthenticated, permission-denied, invalid-argument, not-found, unavailable. Online-only; retain ambiguous request across navigation for explicit retry. Paid UI comes from server-confirmed subscription only. No bank verification or reverse transition.

### 6.5 VietQR Quick Link — read-only client integration (SL-026)

**Provider:** `https://img.vietqr.io/image/{bankBin}-{accountNumber}-qr_only.svg?amount={shareVnd}&addInfo={encodedMemo}&accountName={encodedAccountName}`. Use the existing `expo-image` SVG renderer; no API key, Functions, billing, or payment write is added. Provider documentation: [Quick Link](https://www.vietqr.io/qr-dong), [October 2026 SVG transition](https://www.vietqr.io/thong-bao-cap-nhat), checked 2026-10-22. External service availability is not guaranteed by Firebase Spark.

**Inputs:** authenticated user's ACTIVE/EARLY_EXIT membership in this finalized room, its eight-digit PIN, display name, current `published` bill revision, and server-confirmed `settlementDetails/current`. Cached/pending-write/error/unpublished states are insufficient. A room/account/publication change immediately invalidates the displayed QR. Read bank-detail changes in realtime with existing membership/expiry Rules; refresh reconnects failed subscriptions. Do not persist bank details or QR URLs locally or log them.

**Validation:** share must belong to the current user, be a nonnegative safe integer, and come from a unique-UID vector whose exact sum matches the integer room bill. Zero share returns a no-transfer state without a provider request. Positive amounts are at most 13 digits. Require a six-digit bank BIN and 1–19 ASCII letters/digits in the account number; legacy manually entered bank IDs remain stored but require Host correction before QR generation. Details for another room, expired details, missing payee/name, and unsupported names return unavailable rather than mock values.

**Memo:** `DL {roomPin} {memberName}`. Strip Vietnamese combining accents, map Đ/đ to D, uppercase, replace non-ASCII alphanumeric characters with spaces, collapse whitespace, and trim. Limit the full memo to 50 ASCII characters by shortening only the name. An empty normalized name returns unavailable. Percent-encode memo and account name separately; preserve leading zeros in the account number. Account name affects provider display only and is not proof of the recipient's identity.

**Presentation:** loading, provider timeout/error with manual retry, expired/unavailable, offline, and zero-share states. Hide the QR when leaving foreground or when either input ceases to be current. The device expiry check is a display safeguard; Firestore Rules still authorize data reads. Selected text supports native copying; no simulated clipboard or payment confirmation. Bank-app scan validation on five actual apps is still required before claiming compatibility. SL-027 alone owns manual paid status.

## 8. Activation callable

### 7.1 `redeemActivationCode`

**Request:** common request plus required `activationCode: string` matching `DONTLIFT-XXXX-XXXX-XXXX`.

**Response:** common response plus `serverPremium: true`, `redeemedAtUtcMs`, and `serverBenefits: ["UNLIMITED_ROOM_CAPACITY", "UNLIMITED_MONTHLY_CREATION", "ADVANCED_LEADERBOARD"]`.

**Errors:** `unauthenticated`; `invalid-argument` for malformed/checksum-invalid code; `not-found` for an unknown code; `already-exists` when redeemed by another user or request ID collides; `failed-precondition` when account state cannot accept redemption; `unavailable`.

**Transaction outputs:** read `activationCodes/{codeHash}`, verify unused code, set `redeemedBy` and `redeemedAt`, set `users/{uid}.isPremium = true`, and store command receipt atomically. Plaintext activation codes are never document IDs or logs.

## 9. `completeRegistrationProfile`

**Purpose:** Initialize the authenticated user's profile after Firebase Email/Password account creation. This is a callable Cloud Function and requires Firebase Authentication.

**Request schema**

| Field | Type | Required | Rule |
|---|---|---|---|
| `version` | integer | yes | `1` |
| `requestId` | UUID string | yes | Common idempotency rule |
| `displayName` | string | yes | Trimmed; 1–40 Unicode code points |

The request does not accept `uid`, `email` or `password`. The Function derives `actorUid` from the verified Firebase Auth context and reads the email from the corresponding Firebase Auth user record. If the authenticated record has no email, return `failed-precondition`.

Both client and Function trim and validate `displayName`. The Function is authoritative and repeats all validation.

**Response schema:** common response plus `profile`:

| Field | Type | Rule |
|---|---|---|
| `profile.uid` | string | Authenticated UID |
| `profile.displayName` | string | Canonical trimmed name |
| `profile.email` | string | Email from Firebase Auth |
| `profile.isPremium` | boolean | Initial value is `false`; server-owned |
| `profile.createdAtUtcMs` | integer | Server-observed creation timestamp |

**Transaction behavior:**

1. Read `users/{uid}/commandReceipts/{requestId}`. If present with the same canonical payload, return its previous outcome. If the payload differs, return `already-exists`.
2. Read `users/{uid}`. If absent, create it with `displayName`, `email`, `isPremium: false`, and server timestamps `createdAt` and `updatedAt`.
3. If the profile already exists, do not overwrite it; return its canonical profile. Profile editing is a separate journey.
4. Store the request receipt and outcome atomically with profile creation where applicable. Receipt writes are server-only.
5. Never log full email, password, ID token, or refresh token.

**Errors:** `unauthenticated`; `invalid-argument` for an invalid name or malformed envelope; `failed-precondition` when the Auth record lacks an email; `already-exists` when a `requestId` is reused with another payload; `unavailable` for retryable service failure. Errors follow the common safe-error shape.

**Recovery:** The client may retry after Auth account creation succeeds but this Function or the local SQLite write fails. Repeating the same request is idempotent. A retry must not overwrite an existing profile. The app remains in a retryable profile-completion state until the server profile and local projection are available.

---

## 10. Contract validation obligations

- Functions tests cover every required field, error code, idempotent replay and payload-hash collision.
- `completeRegistrationProfile` tests cover Auth-derived identity, trimmed-name validation, create-only profile initialization, same-request replay, request-ID payload collision, existing-profile preservation, and retryable failure.
- Security tests verify that direct writes cannot reproduce any transaction output owned by a Function.
- Property tests verify bill-share non-negativity and `sumShareVnd == totalBillVnd` for default and override calculations, including totals not divisible by 1,000.
- Emulator tests verify `HOST_OVERRIDE` audit append, late-event exclusion, settlement-details membership reads and 30-day deletion eligibility.
