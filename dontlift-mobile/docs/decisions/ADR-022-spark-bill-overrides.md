# ADR-022: Spark Host bill overrides

## Status

Accepted for SL-025 on 2026-10-22.

## Context

SL-024 publishes Host-calculated shares on Firebase Spark under ADR-021. The existing default share set is immutable. The product owner approved Host overrides while preserving the Firebase Spark plan and the existing restriction that Rules authorize writes but cannot verify the calculation or complete roster.

## Decision

- The Host may publish successive replacement bill versions only before the first member is marked paid. Once any member is marked paid, future overrides are denied. SL-027 must increment `rooms/{roomId}.billPaidCount` in the same Rules-authorized transaction that changes a share to paid; an absent counter on legacy rooms means zero.
- Each override uses a new UUID request ID and an expected `billRevision`. An absent revision or `billPaidCount` on a legacy/default-only room means zero; SL-024 does not need to write these fields, preserving compatibility with older app builds. The final transaction checks the expected revision and paid count, then atomically advances `billRevision` and `billOverrideRequestId`. Concurrent publications based on the same revision cannot both win.
- Override shares are staged at `rooms/{roomId}/billOverrides/{requestId}/shares/{uid}` in sequential transactions containing no more than eight share writes. A preparation remains hidden from Members until the room pointer changes. Published versions and command receipts are immutable; superseded versions are retained until the room retention policy expires. No physical cleanup is promised by this slice.
- The Host may replace selected members' raw shares with fixed VND or basis-point percentages. Non-overridden members retain their default raw allocation. The resulting complete raw vector must equal the full bill exactly before rounding; otherwise the command is rejected. Default and override vectors use the same ADR-005 integer rounding and residual pipeline. No remainder-after-override distribution is added.
- Security Rules authorize the Host, finalized room, membership, settlement expiry, revision and unpaid state; Rules do not recalculate the vector or prove roster completeness. Shares are Host-attested on Spark, not server-verified.
- The member listener reads the default `/billShares` collection when no override pointer exists; otherwise it reads only the active version's `billOverrides/{requestId}/shares` collection. Members cannot read staged or superseded versions.
- SL-025 adds no Cloud Functions, Cloud Billing, paid service, offline command queue, or automatic payment integration. Commands require a live connection.

## Consequences

- Hosts can correct a split before payment starts without exposing partially staged data.
- A publication is a compare-and-swap on the room revision; a lost response can be retried with the same request ID and payload.
- Future payment marking must update the shared paid counter atomically. A payment implementation that omits that counter violates this ADR and would not lock overrides.
- A modified Host client can still publish incorrect values or omit roster members; stronger guarantees require a separately approved trusted backend.

## Source

- ADR-005: shared deterministic rounding pipeline and exact-sum invariant.
- ADR-021: Spark Host-calculated default bill publication.
- Human approval in the SL-025 conversation, 2026-10-22: allow Host recalculation before first payment; lock after any Member is marked paid; use revisioned Spark staging with bounded chunks and one atomic visibility switch.
