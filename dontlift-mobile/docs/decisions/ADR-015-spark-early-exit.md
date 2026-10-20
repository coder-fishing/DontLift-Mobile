# ADR-015: Early exit trên Firebase Spark

## Status

Accepted — human approval 2026-10-20.

## Context

SL-018 needs a Member request and a Host decision, while the project must stay on Firebase Spark. The original plan routes both commands and group-event ingestion through Cloud Functions, which does not fit the no-billing constraint. ADR-013 and ADR-014 already use narrowly scoped Firestore transactions checked by Security Rules.

## Decision

- `requestEarlyExit` and `decideEarlyExit` use authenticated, online Firestore client transactions guarded by Security Rules. They are not queued offline and do not deploy Cloud Functions or enable billing.
- A room has one current early-exit request document per Member at `rooms/{roomId}/earlyExitRequests/{memberUid}`. A denied Member can submit a new request with a new UUID; the current document is updated, so this resource is not an audit log.
- Only an ACTIVE Member in an ACTIVE room can open a request. Only the ACTIVE Host can decide the current OPEN request. Approval changes the requester to `EARLY_EXIT` and records `earlyExitAt` using server time; denial leaves the Member ACTIVE. Membership remains in the room roster and history.
- The approved cutoff is the server timestamp of the Host approval transaction. A confirmed violation contributes to the shared score only when its `endedAt` is at or before that cutoff. An event ending exactly at the cutoff is eligible; an event ending after it does not increase the score.
- An eligible event that arrives after approval may still update the Member aggregate while the room remains ACTIVE. If the room has already ended, its local outbox remains pending for SL-020 reconciliation. Final settlement remains subject to ADR-003 reconciliation; this decision does not freeze settlement at early exit.
- Rules require the request/decision document and any approved Member status/cutoff change to occur atomically. They retain the ADR-014 event-to-own-member aggregate invariant and additionally enforce the early-exit cutoff.

## Consequences

### Positive

- SL-018 works on Spark without a paid backend deployment.
- Realtime request visibility uses Firestore listeners; authorization and state transitions are checked by Rules.
- Events before or exactly at the cutoff can be included before final reconciliation, even when their delivery is late.

### Negative

- Security Rules and client emulator tests must enforce multi-document invariants; Rules denials may surface as `permission-denied`.
- Requests and Host decisions require a connection. Rejected and retried requests overwrite the prior request document, so the collection does not provide a decision audit trail.
- Firestore Spark quotas still apply. Pending events after room completion require SL-020 reconciliation before final settlement.

## Source

- Human approval in the SL-018 conversation, 2026-10-20: server-time cutoff, events ending at or before cutoff eligible, events crossing the cutoff excluded from score, late eligible events retained for SL-020 reconciliation, and Firestore transaction plus Rules on Spark.
- [ADR-003](ADR-003-authoritative-command-boundary.md), [ADR-013](ADR-013-spark-room-start.md), [ADR-014](ADR-014-spark-group-violations.md), and [SL-018 API contract](../api-contracts.md#3-1-early-exit-spark-transactions).
