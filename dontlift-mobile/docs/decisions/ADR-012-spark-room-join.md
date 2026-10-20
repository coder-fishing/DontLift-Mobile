# ADR-012: Member join by PIN on Firebase Spark

## Status

Accepted — human approval 2026-10-20.

## Decision

- `joinRoomByPin` uses the authenticated Firebase JS client and one Firestore transaction guarded by Security Rules; SL-014 does not deploy a Cloud Function.
- New rooms use an eight-digit numeric PIN. Existing four-digit reservations remain readable for migration compatibility. `roomPins/{pin}` allows authenticated document `get`; collection `list` remains denied.
- Rules authorize room lookup only through the reservation path, validate room state and server-owned Host entitlement, enforce the five-person Free capacity, and atomically link membership, participant count, and the request receipt.
- `lastJoinRequestId` on the room links a count increment to its receipt; Rules require the member document to be absent before the transaction, so an existing member cannot replay a second increment.
- A Member already present is returned idempotently without changing participant count. Offline joins fail and are not queued.
- Firestore Rules do not rate-limit document reads. Eight digits reduce guessing probability, but authenticated callers can still enumerate candidate PINs and consume Firestore read quota. This is an accepted limitation for the Spark implementation; it is not represented as a complete anti-enumeration control.
- Firestore is the canonical source. SQLite is updated only after the join commit and authoritative timestamps have been read.

## Consequences

- SL-014 works without Cloud Functions or enabling billing.
- Rules must prevent membership/count/capacity bypass and reject collection listing, unauthorized room writes, and cross-user membership writes.
- PIN lookup is online. The UI reports generic not-found for unknown and expired PINs.
- PIN reservations remain unique under the SL-013 lifecycle policy; this slice does not delete or recycle reservations.

## Source

- Human decision in conversation, 2026-10-20: retain Firebase free tier and move new join codes to eight digits.
- Firebase Firestore transaction and Security Rules contracts.
