# ADR-023 — Host manual payment confirmation on Spark

Status: Accepted, 2026-10-22. The human approved the SL-027 Spark contract in this conversation.

## Decision

Only the actual room Host with ACTIVE HOST membership can mark a positive current-version share as MARKED_AS_PAID. The room must be COMPLETED/FINALIZED with calculationVersion 1 and unexpired settlement details. Zero shares display No payment due and do not increment a counter.

Use a Firebase JS SDK transaction checked by Firestore Rules, without Functions or billing. Resolve default or override share from the room publication pointer. The command binds version 1, UUID requestId, roomId, memberUid, targetStatus, publicationRequestId and expectedRevision.

Atomically add paymentStatus, server paidAt, paidBy and paymentRequestId to the existing share, increment room billPaidCount, set lastPaymentRequestId, and create billPaymentCommands/{requestId}. The immutable receipt also stores actorUid and shareVnd. Share amount, UID and publication fields remain immutable. Rules require a new receipt, unpaid previous share and exact current pointer/revision; partial writes and paid reversal are denied. Both payment and override update the room, serializing their race. The first payment locks overrides under ADR-022.

Matching receipts replay before current publication/readiness checks after Host authorization. Changed payload with an existing request ID is already-exists. A new command for a paid share fails precondition. A committed response whose timestamp readback fails remains successful with paidAtUtcMs null. Never substitute device time. Receipt replay remains Host-readable after settlement expiry.

Commands require connectivity and have no offline outbox. An ambiguous request stays in memory across navigation with an independent retry action. Only server-confirmed subscription state displays paid. Room counter and share markers must agree before publishing a live snapshot. Older command responses cannot replace newer revisions or reduce observed paid counts.

The Host confirms member and amount in a modal warning about the bill lock. Members cannot confirm their own payment. The bill and own QR screen show Host-confirmed status; confirmed paid shares no longer render a transfer QR. This is a manual attestation, not bank verification.

## Limits

Existing Spark bill math remains Host-attested (ADR-021/022). No bank polling, bank verification, reverse payment, receipt deletion or persisted offline payment queue. A process restart can lose the in-memory retry ID; the paid share and Rules still prevent a second increment.
