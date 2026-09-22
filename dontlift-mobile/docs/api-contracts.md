# DontLift Callable API Contracts

> **Owner:** Software architecture package  
> **Status:** APPROVED  
> **Wire version:** `1`  
> **Region:** `asia-southeast1`

## 1. Common envelope

Every callable requires Firebase Authentication. Functions derive `actorUid` from the verified ID token and never trust a UID supplied by the client.

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

## 2. `createRoom`

**Request schema**

| Field | Type | Required | Rule |
|---|---|---|---|
| `version` | integer | yes | `1` |
| `requestId` | UUID string | yes | Common idempotency rule |

**Response schema:** common response plus `roomId: UUID`, `pin: four-digit string`, `status: "WAITING"`, `hostId: string`, `createdAtUtcMs: integer`.

**Errors:** `unauthenticated`; `failed-precondition` when entitlement state is not usable; `resource-exhausted` when monthly quota is reached; `unavailable` for retryable service failure; `already-exists` for request-ID collision.

**Transaction outputs:** reserve `roomPins/{pin}`, create `rooms/{roomId}`, create Host membership, increment `users/{uid}/usage/{yyyyMM}` and store command receipt atomically.

## 3. `joinRoomByPin`

**Request schema**

| Field | Type | Required | Rule |
|---|---|---|---|
| `version` | integer | yes | `1` |
| `requestId` | UUID string | yes | Common idempotency rule |
| `pin` | string | yes | Exactly four decimal digits |

**Response schema:** common response plus `roomId: UUID`, `status: "WAITING"`, `memberUid: string`, `joinedAtUtcMs: integer`, `alreadyMember: boolean`.

**Errors:** `unauthenticated`; `invalid-argument` for malformed PIN; `not-found` for an unknown or expired PIN without room internals; `failed-precondition` when room is not `WAITING`; `resource-exhausted` when verified Host entitlement does not permit another Member; `unavailable`; `already-exists` for request-ID collision.

**Transaction outputs:** resolve server-only PIN reservation, validate room/capacity, create membership only when absent, update `participantCount` and store command receipt atomically.

## 4. `syncEvents`

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

`VIOLATION_RECORDED.payload` requires `startedAtUtcMs`, `endedAtUtcMs`, `durationSeconds` and optional `roomId`. `SOLO_SESSION_COMPLETED.payload` requires `durationSeconds`, `liftCount`, `violationDurationSeconds`, `penaltyScore`, `startedAtUtcMs` and `completedAtUtcMs`. `GROUP_SESSION_LOCAL_SUMMARY.payload` requires `roomId`, `liftCount`, `violationDurationSeconds`, `penaltyScore` and `completedAtUtcMs`.

**Response schema:** `version: 1`, `serverTimeUtcMs`, and one `outcomes[]` item per event with `eventId`, `status: "SYNCED" | "FAILED"`, `retryable: boolean`, optional stable `errorCode`, and optional `destinationRef`.

**Errors:** request-level `unauthenticated`, `invalid-argument`, `resource-exhausted`, `unavailable`. Event-level failures use `permission-denied`, `invalid-argument`, `failed-precondition`, `not-found` or `already-exists`. A transport failure leaves local status `PENDING`; a permanent event failure maps to local `FAILED`.

**Transaction outputs per new event:** validate actor/ownership/session window; read receipt; write destination domain document; update aggregate where applicable; write `users/{uid}/syncReceipts/{eventId}` in one transaction. A matching receipt returns its previous outcome without another domain effect.

## 5. Reconciliation callables

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

## 6. Bill and settlement callables

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

## 7. Activation callable

### 7.1 `redeemActivationCode`

**Request:** common request plus required `activationCode: string` matching `DONTLIFT-XXXX-XXXX-XXXX`.

**Response:** common response plus `serverPremium: true`, `redeemedAtUtcMs`, and `serverBenefits: ["UNLIMITED_ROOM_CAPACITY", "UNLIMITED_MONTHLY_CREATION", "ADVANCED_LEADERBOARD"]`.

**Errors:** `unauthenticated`; `invalid-argument` for malformed/checksum-invalid code; `not-found` for an unknown code; `already-exists` when redeemed by another user or request ID collides; `failed-precondition` when account state cannot accept redemption; `unavailable`.

**Transaction outputs:** read `activationCodes/{codeHash}`, verify unused code, set `redeemedBy` and `redeemedAt`, set `users/{uid}.isPremium = true`, and store command receipt atomically. Plaintext activation codes are never document IDs or logs.

## 8. Contract validation obligations

- Functions tests cover every required field, error code, idempotent replay and payload-hash collision.
- Security tests verify that direct writes cannot reproduce any transaction output owned by a Function.
- Property tests verify bill-share non-negativity and `sumShareVnd == totalBillVnd` for default and override calculations, including totals not divisible by 1,000.
- Emulator tests verify `HOST_OVERRIDE` audit append, late-event exclusion, settlement-details membership reads and 30-day deletion eligibility.
