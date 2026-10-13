# Review kế hoạch — SL-020

**Target:** [Plan](../plans/2026-10-13-sl-020-room-completion.md).
**Baseline:** Existing GroupActive end path skips reconciliation summary; route ownership convention in [AGENTS.md](../../../AGENTS.md#L39).
**Nguồn:** [PR #24](https://github.com/coder-fishing/DontLift-Mobile/pull/24), reviewed commit `4e681b6`.
**Execution scope:** Chỉ sửa plan/index/report; không tạo app route hoặc backend code.

## PR24-4256183795

- **Status:** RESOLVED
- **Severity:** High
- **Category:** Completion/reconciliation route ownership
- **Location:** SL-020 mục 3/5/6.
- **Problem:** GroupActive navigates directly to bill allocation; GroupSummary is not registered, so PENDING/ALL_SYNCED state and settlement gate are unreachable.
- **Recommendation:** SL-020 owns GroupSummary screen state/rendering and changes GroupActive End transition to show reconciliation before settlement; SL-021 extends the same route for override-specific warning/state.
- **Created At:** 2026-10-13, PR #24 review on commit `4e681b6`.
- **Updated By:** Codex, after user requested continuing the corrections.
- **Updated At:** 2026-10-13, Asia/Saigon.
- **Review reference:** [P1 finding](https://github.com/coder-fishing/DontLift-Mobile/pull/24#discussion_r4256183795); repository rule: [AGENTS.md](../../../AGENTS.md#L39).
- **Response:** SL-020 now owns the GroupActive callback, GroupSummary route/ScreenId/title, and navigation acceptance. PENDING blocks bill/settlement; ALL_SYNCED/FINALIZED permits continuation. SL-021 extends the existing summary instead of bypassing it.

## Self-review

- Finding is resolved at plan-ownership level only; route/device behavior remains unimplemented and unverified.
- Existing completion contracts and stable slice IDs are preserved.

## PR24-4259477680

- **Status:** RESOLVED
- **Severity:** High
- **Category:** Early-exit reconciliation dependency and ACK
- **Location:** SL-020 dependency header, complete/ACK tasks and acceptance; `docs/implementation-plan.md` row SL-020.
- **Problem:** SL-020 could freeze the pending-member set before SL-018 owns early-exit cutoff and late pre-cutoff event handling, leaving reconciliation pending or finalizing without eligible events.
- **Recommendation:** Add SL-018 as a prerequisite and test room completion after approved early exit.
- **Created At:** 2026-10-13, review trên commit `45d52aa`.
- **Updated By:** Codex.
- **Updated At:** 2026-10-13, Asia/Saigon.
- **Review reference:** [P1 finding](https://github.com/coder-fishing/DontLift-Mobile/pull/24#discussion_r4259477680).
- **Response:** SL-020 nay phụ thuộc SL-018, giữ exit member trong pending reconciliation tới khi eligible pre-cutoff events durable và ACK hợp đồng qua `endedAt`; test integration cover delivery sau completion, không finalize sớm/kẹt PENDING, và không đổi frozen exit stats bằng event sau cutoff. D3 còn chặn exact cutoff/ACK concurrency semantics; [AGENTS.md dòng 14–17](../../../AGENTS.md#L14-L17) giữ architecture/API làm nguồn ưu tiên.

## Self-review update

- Dependency SL-017 → SL-018 → SL-020 is acyclic; SL-021 remains downstream of SL-020.
- No wire fields or early-exit policies were invented; D3 remains an execution blocker until approved.
