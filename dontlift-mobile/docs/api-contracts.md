# DontLift Firebase Command Contracts

> Runtime update 2026-10-18: [ADR-010](decisions/ADR-010-expo-go-firebase-js.md) replaces native Firebase with Firebase JS SDK / Expo Go and replaces callable registration bootstrap with create-only Firestore Rules. Other planned authoritative commands below remain future work.

> Room-creation update 2026-10-20: [ADR-011](decisions/ADR-011-spark-room-creation.md) replaces the `createRoom` callable with one authenticated Firestore client transaction guarded by Security Rules. This exception is designed for Firebase Spark and does not change the remaining callable contracts.

> Room-start update 2026-10-20: [ADR-013](decisions/ADR-013-spark-room-start.md) adds a narrowly scoped Rules-authorized `startRoom` Firestore transaction for Firebase Spark. It does not add a callable or alter other lifecycle commands.

> Early-exit update 2026-10-20: [ADR-015](decisions/ADR-015-spark-early-exit.md) adds narrowly scoped Rules-authorized transactions for early-exit requests and decisions, plus the per-Member cutoff used by SL-017 violation sync. No Cloud Functions or billing are added.

> **Owner:** Software architecture package  
> **Status:** APPROVED  
> **Wire version:** `1`  
> **Region:** `asia-southeast1`

## 1. Common envelope

Every callable requires Firebase Authentication. Functions derive `actorUid` from the verified ID token and never trust a UID supplied by the client. `createRoom` (§2), `startRoom` (§3), and `joinRoomByPin` (§4) are Rules-authorized transaction exceptions defined by their corresponding ADRs.

Every side-effecting request contains:

| Field | Type | Required | Rule |
|---|---|---|---|
| `version` | integer | yes | Must equal `1` |
| `requestId` | UUID string | yes | Idempotency key for the authenticated actor and function |

Every success response contains:

| Field | Type | Rule |
|---|---|---|
| `version` | integer | Always `1` |
| `requestId` | UUID string | Echoes the accepted request |
| `serverTimeUtcMs` | integer | Server-observed UTC timestamp |

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

The transaction reads `rooms/{roomId}` and `rooms/{roomId}/members/{authenticatedUid}` before writes. Rules require `room.hostId == request.auth.uid`, the membership role/status to be `HOST`/`ACTIVE`, and the current room state to be `WAITING`. The only allowed update changes `status` to `ACTIVE`, sets `startedAt` and `updatedAt` to `serverTimestamp()`, and sets `lastStartRequestId` to the request ID. Rules require both timestamps to equal `request.time`; every other room field remains unchanged.

**Replay and concurrency:** `lastStartRequestId` is the durable marker for the room's one start transition. If the room is already `ACTIVE` with the same marker, return the existing outcome. If it is `ACTIVE` with another marker, return `failed-precondition`. Concurrent transactions serialize on the room document; a retry with the same ID receives the committed outcome, while a different ID cannot produce a second transition. No separate command receipt is created.

**Response:** `{ version: 1, requestId, roomId, status: "ACTIVE", startedAtUtcMs }`, where `startedAtUtcMs` is read from the committed server timestamp. If the write committed but its server readback is unavailable, retain the same request ID; the room listener remains authoritative and a retry reconciles the committed state.

**Errors:** `unauthenticated`; `invalid-argument` for malformed IDs/envelope; `not-found` for a missing room; `failed-precondition` for a room already started by a different request; `permission-denied` for wrong role or a Rules-rejected/raced update; `unavailable` for network/service failure. Rules cannot return application-specific error codes, so ambiguous denials remain `permission-denied`. Offline transactions are not queued.

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

## 6. Reconciliation callables

### 5.1 `completeRoom`

**Request:** common request plus required `roomId: UUID`.

**Response:** common response plus `roomId`, `status: "COMPLETED"`, `endedAtUtcMs`, `reconciliationStatus: "PENDING"`, `pendingMemberUids: string[]` visible only to the Host.

**Errors:** `unauthenticated`, `permission-denied`, `not-found`, `failed-precondition` unless room is `ACTIVE`, `unavailable`, `already-exists`.

**Transaction outputs:** transition `ACTIVE → COMPLETED`, freeze `endedAt`, set reconciliation `PENDING`, compute pending Members and store command receipt.

### 5.2 `acknowledgeMemberSync`

**Request:** common request plus required `roomId: UUID` and `syncedThroughUtcMs: integer`. The timestamp must cover the authoritative room `endedAt`.

**Response:** common response plus `roomId`, `memberUid`, `reconciliationStatus: "PENDING" | "FINALIZED"`, `pendingMemberCount`, optional `finalizationReason: "ALL_SYNCED"`.

**Errors:** `unauthenticated`, `permission-denied`, `not-found`, `failed-precondition` for incomplete flush or wrong room state, `unavailable`, `already-exists`.

**Transaction outputs:** update Member acknowledgment; decrement pending count once; when count reaches zero, finalize scores with `ALL_SYNCED`; store command receipt.

### 5.3 `finalizeRoomScores`

**Request:** common request plus required `roomId: UUID`, `reason: "HOST_OVERRIDE"`, and `confirmedWarning: true`.

**Response:** common response plus `roomId`, `reconciliationStatus: "FINALIZED"`, `finalizationReason: "HOST_OVERRIDE"`, `unsyncedMemberUids`, `auditId` and `scoreSnapshotRef`.

**Errors:** `unauthenticated`, `permission-denied`, `invalid-argument` unless the exact warning was confirmed, `not-found`, `failed-precondition` when already finalized or no Members remain pending, `unavailable`, `already-exists`.

**Transaction outputs:** freeze score snapshot, finalize reconciliation, append `reconciliationAudits/{auditId}` with Host/request/unsynced-member evidence, and store command receipt. Later valid events remain history-only with `excludedFromFinalScore = true` and `exclusionReason = "HOST_OVERRIDE"`.

## 7. Bill and settlement callables

### 6.1 `setSettlementDetails`

**Request:** common request plus required `roomId: UUID`, `bankId: non-empty string`, `accountNumber: non-empty string`, `accountName: non-empty string`.

**Response:** common response plus `roomId`, `updatedAtUtcMs`, `expiresAtUtcMs`.

**Errors:** `unauthenticated`, `permission-denied` for non-Host, `invalid-argument` for malformed fields, `not-found`, `failed-precondition` unless room is `COMPLETED`, `unavailable`, `already-exists`.

**Transaction outputs:** upsert `settlementDetails/current` with expiry at `room.completedAt + 30 days` and store command receipt. Bank fields are redacted from logs and analytics.

### 6.2 `calculateBillShares`

**Request:** common request plus required `roomId: UUID` and `totalBillVnd: integer >= 1000`.

**Response:** common response plus `roomId`, `totalBillVnd`, `calculationVersion: 1`, `shares[]` containing `uid`, `baseShareVnd`, `penaltyShareVnd`, `shareVnd`, and invariant `sumShareVnd` equal to `totalBillVnd`.

**Errors:** `unauthenticated`, `permission-denied`, `invalid-argument`, `not-found`, `failed-precondition` unless reconciliation is `FINALIZED` and settlement details exist, `unavailable`, `already-exists`.

**Transaction outputs:** run the canonical rounding/residual algorithm, replace authoritative bill-share documents, set room total and calculation version, and store command receipt atomically.

### 6.3 `applyBillOverrides`

**Request:** common request plus required `roomId: UUID`, `totalBillVnd: integer >= 1000`, and non-empty `overrides[]`. Each override requires `uid`, `type: "FIXED_VND" | "PERCENT_BPS"`, and non-negative integer `value`; percentage values are basis points.

**Response:** the same response schema as `calculateBillShares`, plus `overrideApplied: true`.

**Errors:** `unauthenticated`, `permission-denied`, `invalid-argument` for duplicate Members, negative values, percentages above 10,000 basis points or a raw vector that cannot represent the full bill; `not-found`; `failed-precondition`; `unavailable`; `already-exists`.

**Transaction outputs:** form the complete raw share vector, run the same canonical rounding/residual algorithm, replace bill-share documents, store override metadata and command receipt atomically. There is no separate remainder-after-override path.

### 6.4 `markBillSharePaid`

**Request:** common request plus required `roomId: UUID`, `memberUid: string`, `targetStatus: "MARKED_AS_PAID"`.

**Response:** common response plus `roomId`, `memberUid`, `paymentStatus: "MARKED_AS_PAID"`, `updatedAtUtcMs`.

**Errors:** `unauthenticated`, `permission-denied`, `invalid-argument`, `not-found`, `failed-precondition` when already paid or settlement is not ready, `unavailable`, `already-exists`.

**Transaction outputs:** perform the one-way payment-status transition and store command receipt. No bank API or automatic verification is called.

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
