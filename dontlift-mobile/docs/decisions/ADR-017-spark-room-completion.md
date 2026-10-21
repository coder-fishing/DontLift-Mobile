# ADR-017: Room completion and sync acknowledgment on Firebase Spark

## Status

Accepted — human approval 2026-10-21 to keep SL-020 on Firebase Spark without enabling billing or deploying Cloud Functions.

## Context

ADR-003 originally assigns `completeRoom` and `acknowledgeMemberSync` to callable Cloud Functions. Deploying Functions requires the paid Blaze plan, while the project must remain usable on Spark and Expo Go. ADR-015 already defines the early-exit cutoff: a violation ending at or before the approved cutoff is eligible, including a late delivery that remains pending after the room ends.

Firestore Rules cannot inspect a participant's SQLite outbox. On Spark, an acknowledgment is therefore an authenticated member's explicit client attestation that its locally eligible outbox has been drained. The app checks its local outbox before sending the transaction. Rules bind the acknowledgment to the member and room, prevent a second decrement, and reject later score events from an acknowledged member. A modified client can lie about local data; this is a known limit of a no-backend Spark design.

## Decision

- `completeRoom` and `acknowledgeMemberSync` are online Firestore client transactions authorized by narrow Security Rules. They are not queued offline. No Functions, billing change, or scheduled service is used.
- Only the active Host can complete an `ACTIVE` room. The transaction changes it to `COMPLETED`, records `endedAt = request.time`, initializes `reconciliationStatus = PENDING` and `pendingMemberCount = participantCount`, and stores `completionRequestId` on the room. The existing participant roster is fixed after start; early-exit members remain in the pending count because they may still have eligible events.
- Each roster member, including the Host and a member with `EARLY_EXIT` status, drains its local eligible events through the room end time before acknowledging. For an early-exit member, only events ending at or before `earlyExitAt` are eligible. A late event may be recorded only while reconciliation is `PENDING` and before that member acknowledges.
- An acknowledgment transaction writes the member's `syncedThroughAt = room.endedAt`, server `syncAcknowledgedAt`, and its request ID while decrementing `pendingMemberCount` in the same transaction. Rules require a fresh member acknowledgment linked to the room update. Duplicate delivery observes the already-acknowledged member and does not decrement again.
- When the last member acknowledges, the same transaction sets `reconciliationStatus = FINALIZED`, `finalizationReason = ALL_SYNCED`, `finalizedAt = request.time`, and `finalizedBy` to the acknowledging UID. Rules reject further violation writes after acknowledgment or finalization. Existing member aggregates are the canonical score projection and become immutable at finalization.
- `pendingMemberUids` is derived from the room-scoped member listener, not returned by a transaction. Members may read only their room roster under existing Rules; outsiders remain denied.
- SL-020 does not implement `HOST_OVERRIDE`, settlement, bill calculation, or a timeout. A room with members who never return remains `PENDING` until the Host uses the separate Spark override defined by [ADR-018](ADR-018-spark-host-finalization-override.md), or the members ACK.

## Consequences

### Positive

- SL-020 works with Spark and Expo Go, with no paid service deployment.
- State transitions and member-score writes share Firestore transactions and Rules-enforced atomic links.
- Room counts are reconciled without querying a collection inside the transaction.

### Negative and limits

- Commands require connectivity; retry uses the same request ID and reads committed room/member markers.
- Rules cannot prove the device's SQLite outbox is empty. The first-party client checks local pending events, then the authenticated member attests to the result. A modified client could acknowledge early and omit its own unsynced penalties. Strong server verification requires a trusted backend, which is outside the Spark constraint.
- There is no timeout or Host override in SL-020, so an absent member can keep reconciliation pending.
- Firestore Rules changes require Emulator Suite validation before deployment; no production Rules deployment is included in this implementation.

## Source

Human direction in the SL-020 conversation, 2026-10-21: continue on the Firebase free tier. Related decisions: [ADR-003](ADR-003-authoritative-command-boundary.md), [ADR-014](ADR-014-spark-group-violations.md), [ADR-015](ADR-015-spark-early-exit.md), and [ADR-016](ADR-016-spark-termination-vote.md).
