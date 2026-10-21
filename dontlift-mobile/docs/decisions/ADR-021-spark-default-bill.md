# ADR-021: Spark Host-calculated default bill shares

## Status

Accepted for SL-024 on 2026-10-22.

## Context

ADR-005 assigns authoritative bill calculation to Cloud Functions. Deploying Cloud Functions requires the Firebase Blaze plan and a linked Cloud Billing account, which conflicts with the product owner's Spark-only constraint. Firestore Security Rules can constrain the authenticated Host, room lifecycle, document ownership, and field shapes, but cannot independently recompute the complete roster-wide allocation and prove that every submitted share is correct.

SL-024 still needs a canonical breakdown stored in Firestore so room Members can read the Host's published result. The product owner explicitly accepts Host-calculated shares with this narrower Rules guarantee and does not authorize a billing upgrade.

## Decision

- For SL-024, the authenticated Host client computes default shares from the finalized Firestore score snapshot using the integer algorithm and deterministic rounding in ADR-005 and the Feature Specification.
- The Host submits the bill total, the complete calculated breakdown, and the room calculation metadata in one online Firestore transaction. A successful transaction is the publication boundary; no optimistic or locally cached preview is represented as published.
- Firestore Rules authorize writes only by the room Host while the room is `COMPLETED/FINALIZED` and settlement details exist. Rules validate ownership, lifecycle and data shape, and deny client writes by other members and outsiders. They do not prove the Host used the correct score snapshot, included every member, or calculated the shares correctly.
- The Host-submitted breakdown is the canonical published result for this Spark deployment. A modified or faulty Host client can publish an incorrect or incomplete result. Eliminating that trust requires a trusted backend and is outside this decision.
- Room Members in the same room may read the published breakdown. Outsiders and cross-room members may not read it. Members cannot write, recalculate, or publish shares.
- Keep the established `rooms/{roomId}/billShares/{uid}` resource path. The immutable `rooms/{roomId}/billCommands/{requestId}` receipt records the Host, request ID, total, calculation version, sum, share count, and share UIDs for replay; reuse with the same request and payload returns the committed result, while a conflicting reuse is rejected.
- Publish only each Member's final `shareVnd` in SL-024. Base and penalty breakdown amounts are not stored or shown because ADR-005 rounds the combined raw share and does not define separate component rounding.
- A room may publish its default bill breakdown once in SL-024. A same-request retry replays its receipt; a new request after publication is rejected. Editing or replacing published shares requires a separately approved slice/policy.
- Preserve ADR-005's integer VND, non-negative result, deterministic residual order, frozen early-exit score, and exact-sum invariant for the supported client algorithm. These math invariants are verified by app-side validation and tests, not by Rules.
- Interpret “non-zero base share” as a positive mathematical base component before the ADR-005 rounding step. A final integer share may be zero after the specified rounding and residual distribution when the bill is small relative to the roster. Do not add a minimum per-member bill or distort the agreed rounding pipeline.
- This is a narrowly scoped SL-024 Spark exception. It does not authorize other bill commands, overrides, payment status writes, Cloud Functions deployment, Cloud Billing, or weakening their contracts.

## Consequences

### Positive

- SL-024 can publish and read room bill breakdowns while the Firebase project stays on Spark.
- The app uses the same deterministic integer allocation algorithm and atomically publishes the full result.
- Host-only writes and member-scoped reads remain enforced by Rules.

### Negative

- Published calculation correctness and roster completeness are Host-client attestations, not server-verified facts.
- A modified Host client can write incorrect shares despite the Rules authorization checks.
- Moving back to server-authoritative calculation requires a trusted backend and a separately approved billing/backend decision.

## Source

- ADR-005: integer VND and deterministic rounding invariants.
- API contract §6.2 and SL-024 implementation plan.
- Human approval in the SL-024 conversation, 2026-10-22: keep Spark; allow Host-calculated shares with Rules enforcing permissions and room state but not calculation correctness; define non-zero base before rounding.
- Human approval in the SL-024 conversation, 2026-10-22: publish once; later edits require a separately approved policy; store/display final share amounts only.
