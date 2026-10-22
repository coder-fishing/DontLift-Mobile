# SL-024 chunked bill publication design

## Status

Approved for implementation on 2026-10-22. This design keeps the Firebase Spark constraint and the approved Host-calculated authority model.

## Problem

`validBillShareCreate` currently checks the target membership document for every `billShares/{uid}` write. Firestore Rules allow at most 20 document access calls for a transaction or batch. A room with more than 20 distinct recipients therefore cannot publish all shares in the current single transaction, despite remaining below Firestore's 500-write limit.

## Goals

- Keep the Firebase Spark plan; use Firestore client SDK and Rules only.
- Keep validating that each staged share UID has an `ACTIVE` or `EARLY_EXIT` membership.
- Keep `rooms/{roomId}/billShares/{uid}` and the immutable `billCommands/{requestId}` publication receipt.
- Keep all shares invisible to room members until the complete breakdown is published.
- Resume safely after an interrupted preparation or chunk write.
- Preserve publish-once behavior and reject a conflicting bill total or request payload.

## Data flow

1. **Prepare:** In one small transaction, the Host creates a room-scoped `billPreparations/current` manifest and locks the room to its request ID, total, and share count. The manifest contains the validated UID list, expected sum, calculation version, Host UID, request ID, and `PREPARING` status. Rules link the manifest and room lock in the same transaction.
2. **Stage:** The client writes shares in sequential transactions of at most eight recipients. Each share write still checks the active Host, finalized room, unexpired settlement details, target membership, and UID inclusion in the preparation manifest. The room remains without `calculationVersion`, so member read Rules continue to hide every staged share. Host-only exact reads of staged shares allow a retry to skip already-written documents safely.
3. **Publish:** After every share write is acknowledged, one final transaction changes the room to published, changes the preparation status to `PUBLISHED`, and creates the immutable `billCommands/{requestId}` receipt. Rules require all three linked outcomes in that transaction. Member share reads require the published room and receipt, so the breakdown becomes visible at one commit boundary.

The chunk size is eight to leave headroom under the 20-call transaction-wide Rules budget: at most eight distinct target-member reads plus shared Host, room, preparation, and settlement documents. No Cloud Function, scheduled task, billing upgrade, or paid Firebase service is introduced.

## Retry behavior

- If preparation exists and is still `PREPARING`, retry reads that manifest and resumes its original request ID and total. A conflicting total fails with `failed-precondition`.
- For each UID, retry reads the staged share; an identical share is skipped, while a conflicting existing share fails closed.
- If all chunks committed but the publish transaction response was lost, retry checks the published room and immutable command receipt and returns the saved shares.
- Only one preparation may own a room. A conflicting request cannot replace or clear it in this slice.

## Rules and visibility

- Members and outsiders cannot read `billPreparations` or any share while the room is preparing.
- The Host can read a staged share by exact document path only while its matching room preparation is active. Collection listing stays denied before publication.
- Every staged share remains tied to an actual active or early-exit member and the prepared UID list.
- Member share reads remain membership-scoped and require the completed/finalized room, unexpired settlement details, and the published receipt.
- The Host supplies the UID list and computed values. Rules still do not prove roster completeness or recalculate shares, as approved in ADR-021.
- Share documents cannot be updated or deleted. Published receipt payload is immutable; the preparation has only the one-way `PREPARING` to `PUBLISHED` state transition.

## Files and verification

- Update `firestore.rules`, `bill-repository.ts`, the SL-024 API contract, ADR-021, and the implementation plan.
- Extend `bill-shares-rules.emulator.test.cjs` to cover more than 20 members, per-recipient membership denial, hidden staged shares, and atomic publication visibility.
- Add repository coverage for interrupted chunk retries and receipt replay.
- Run the focused unit tests, TypeScript check, and Firestore Emulator rules suite. The Emulator suite requires Java; no production Rules deployment is part of this change.

## Review check

- The design retains a single atomic **visibility boundary**, while the hidden share documents are staged in smaller authorized transactions.
- The immutable publication receipt is created only with the final room update.
- The transaction-wide access budget includes at most eight distinct recipient membership documents per chunk, plus shared references.
- No rule grants Members or outsiders access to in-progress publication data.
