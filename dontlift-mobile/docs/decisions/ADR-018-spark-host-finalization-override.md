# ADR-018: Host finalization override on Firebase Spark

## Status

Accepted — human approval 2026-10-21 to keep SL-021 on Firebase Spark without enabling billing or deploying Cloud Functions.

## Context

SL-020 finalizes a completed room after all members acknowledge their local sync. A member who does not return can leave the room pending indefinitely. The existing `finalizeRoomScores` callable contract would require Cloud Functions, which cannot be deployed on Spark. ADR-017 already accepts narrow client transactions enforced by Firestore Rules for room completion and ACK.

## Decision

- `finalizeRoomScores` is an online Firestore client transaction guarded by narrow Security Rules. It is not queued offline. No Functions, billing change or scheduled service is used.
- Only the active Host may finalize a `COMPLETED/PENDING` room with `pendingMemberCount > 0`, after confirming the exact warning: `Some Members have not synced. Late violations will not affect payment.`
- The transaction atomically changes the room to `FINALIZED/HOST_OVERRIDE`, stores the request marker, and creates `rooms/{roomId}/reconciliationAudits/{requestId}`. The audit is create-only and records Host UID, request ID, confirmed-warning attestation, room end time, server creation time, pending count, the pending UIDs observed from the Host's room roster snapshot, and a reference to the now-frozen room member score documents.
- The UID list is an authenticated Host-observed attestation. Firestore Rules cannot query the full roster or prove client-supplied list completeness. The UI must label the list as what the Host saw; it must not claim server verification.
- Finalized member score documents are immutable. After `HOST_OVERRIDE`, eligible late events may be appended to violation history with `excludedFromFinalScore = true` and `exclusionReason = HOST_OVERRIDE`; they cannot update scores or the audit.
- Replaying the same request ID returns the committed outcome. A different request after finalization fails. The transaction creates one audit only.
- Bill calculation remains gated on `reconciliationStatus == FINALIZED`; it may consume the frozen member scores after either `ALL_SYNCED` or `HOST_OVERRIDE`.

## Consequences

### Positive

- A Host can release a room from indefinite pending reconciliation while staying on Spark.
- Final scores and audit commit atomically and cannot be changed by late events.
- Expo Go can execute the transaction with the existing Firebase JS SDK.

### Negative and limits

- The command requires network access and cannot be queued offline.
- A modified Host client can misstate the pending UID list. Firestore Rules can verify the room transition and audit linkage but cannot prove the list is complete; the audit records this as a Host observation.
- A modified member client can still omit local pending events, as documented in ADR-017's ACK attestation limit.
- Late history-only writes require Rules Emulator validation before any Rules deployment.

## Source

Human direction in the SL-021 conversation, 2026-10-21: Firebase free tier is sufficient; do not enable billing or deploy paid services. Related decisions: ADR-003 and ADR-017.
