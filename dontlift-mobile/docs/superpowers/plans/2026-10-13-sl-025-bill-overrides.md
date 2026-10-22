# SL-025 — Host overrides bill shares

> Execution plan approved on 2026-10-22. Implement in the current checkout and branch. Keep Firebase Spark; no Functions, billing, deployment, commit, push, or PR is authorized by this plan.

**Status:** IMPLEMENTED / emulator and Expo Go verification pending
**Plan slug:** `2026-10-13-sl-025-bill-overrides`
**Branch:** `feature/sl-025-bill-overrides`
**Prerequisite:** SL-024 default bill shares
**Decisions:** D8 resolved below; Spark authority exception in [ADR-022](../../decisions/ADR-022-spark-bill-overrides.md).
**Traceability:** US-14; API §6.3; ADR-005, ADR-021, ADR-022.

## Goal and scope

Let the Host adjust the finalized bill split with fixed VND or percentage values, preview the complete result, and publish a replacement version that Members see only after it commits. Members remain read-only. Hosts may publish successive versions until the first payment is marked; any paid member locks the split. Use Firestore client transactions and Security Rules on Spark.

Do not add Functions, billing, payment verification, QR generation, score edits, offline queueing, or physical cleanup. Rules authorize the Host and lifecycle but cannot prove calculation correctness or roster completeness.

## Approved decisions

- **D8:** Before first payment, allow replacement versions. After any Member is marked paid, reject further override writes. SL-027 must change the share payment status and increment `rooms/{roomId}.billPaidCount` atomically. Missing count on legacy rooms is interpreted as zero.
- Use a monotonically increasing `billRevision` and `expectedRevision` compare-and-swap. Default-only rooms start at logical revision 0; the fields may remain absent for compatibility with older SL-024 clients. An override advances it by one and sets `billOverrideRequestId` in the final transaction.
- Stage each request in `billOverrides/{requestId}/shares/{uid}` using chunks of at most 8 recipient writes. Members read only the active pointer's version. Publish by atomically switching the pointer, revision, preparation state, and immutable command receipt. A failed or abandoned stage stays hidden. Keep old versions until normal retention expiry.
- Overrides replace selected members' default raw amounts. A percentage is basis points of the room total. Untouched members retain their default raw amount. Reject unless the complete raw vector sums exactly to the bill before rounding. Run default and override vectors through one ADR-005 rounding/residual algorithm; no remainder-after-override branch.
- Same request ID and payload replays its receipt; same ID with a different payload is `already-exists`. Competing expected revisions cannot both publish. No command is queued offline.

## Implementation tasks

1. **Math:** Refactor `src/features/settlement/bill-allocation.ts` so default and overridden exact raw vectors share the same integer rounding path. Use BigInt rational arithmetic; reject invalid UIDs/types/values, duplicate override UIDs, percentages above 10,000 bps, negative shares, non-exact total, unsafe final values, and impossible non-negative allocations.
2. **Contract:** Update API §6.3, feature-spec data model/UX, implementation index D8, ADR-021 scope note, and this plan. Add ADR-022. Clarify in §6.4 that SL-027 must increment the room paid counter atomically.
3. **Repository:** Extend `src/features/settlement/bill-repository.ts` with an online, in-session retryable override command. Stage per-request version documents and share chunks of eight; atomically switch the current pointer only when `expectedRevision` still matches, room remains finalized, settlement details are current, and paid count is zero. Preserve immutable history and same-session retry behavior.
4. **Rules:** Add explicit Rules for override manifest, staged shares, receipt, active-version member reads, and room pointer/revision transition. Preserve existing default-share immutability. Keep per-chunk Rules document accesses within Firestore's atomic-operation access budget. Deny writes when paid count is positive.
5. **Listener and UI:** Listen to the pointer-selected share collection and retain revision/lock metadata. In `BillAllocationScreen`, provide Host-only fixed-VND/percentage controls for each member, inline validation, exact-total preview, explicit replacement confirmation, online/loading/error states, and a paid-lock state. Keep Member controls read-only and use semantic theme tokens, accessible labels, keyboard-safe scrolling, and >=48dp touch targets.
6. **Integration:** Wire screen callbacks in `src/app/index.tsx`; preserve the current published breakdown until a replacement pointer is confirmed. A failed/ambiguous response keeps the same request ID and revision for retry.

## Acceptance criteria

- Member or outsider override attempts are denied; Members can only read the active published version.
- A non-member UID, duplicate UID, negative amount, percentage above 100%, malformed request, or raw vector whose exact sum differs from total is rejected.
- Default and override calculations use one deterministic rounding algorithm, never produce negative shares, and sum exactly to `totalBillVnd`.
- Host can publish a fixed VND override and a percentage override before first payment; after each successful switch, Members see the full new version, never a partial one.
- Same-session retry with the same request ID returns the committed version; changed payload with the same ID is rejected; stale expected revision cannot overwrite a newer version. Request identity is not persisted across app restarts.
- A paid count above zero blocks both preparation/staging and final publication. A payment racing final publication serializes on the room document.
- Existing SL-024 default-only rooms continue to load; absent `billRevision`/`billPaidCount` maps to revision 0/unpaid.
- Staged and superseded versions are not Member-readable. Direct writes to `/billShares` remain denied after initial publication.
- UI validation, keyboard/small-screen layout, and accessibility are checked on Expo Go Android/iOS when devices are available. No false success is shown on offline or ambiguous writes.

## Verification

Run TypeScript and lint checks for changed app code. Rules compilation and authorization behavior require the Firestore Emulator Suite; if Java is unavailable, record it as unverified and do not deploy production Rules. Use unit checks for BigInt boundary cases and integer invariants if the existing runner is available. Inspect the rendered screen on Expo Go; desktop/source review does not count as device verification. Do not claim results that were not observed.

## Current observations

- The repository is clean on `feature/sl-025-bill-overrides` before execution.
- SL-024 already publishes default shares in chunks of 8 and exposes a listener/repository/UI that this slice will extend.
- Rules cannot independently recompute the complete split; this remains the accepted Spark trust boundary.
- Initial implementation must preserve Expo Go/Firebase Cloud operation and must not enable billing or deploy any service.

## Execution record — 2026-10-22

- Contract, ADR-022, Rules, repository, shared BigInt rounding, listener, Host UI, and app callbacks are implemented on `feature/sl-025-bill-overrides`.
- `pnpm exec tsc --noEmit`: PASS. `git diff --check`: PASS.
- `pnpm run lint`: UNVERIFIED/failed as a project check. Expo generated a temporary ESLint config because none existed, then reported 35 errors across existing project files; the generated config was removed to avoid adding an unrequested lint setup.
- Firestore Rules Emulator compilation/authorization: UNVERIFIED because Java is unavailable in this environment. Do not deploy these Rules until Emulator validation succeeds.
- Expo Go Android/iOS visual and interaction check: UNVERIFIED; no attached device session was available. The UI uses existing theme tokens and the existing virtualized `FlatList` pattern.
- No app/domain test cases were added or run in this turn. No production Rules were deployed, and no commit, push, or PR was created.
