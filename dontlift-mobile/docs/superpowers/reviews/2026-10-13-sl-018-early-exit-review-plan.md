# Review kế hoạch — SL-018

**Target:** [Plan](../plans/2026-10-13-sl-018-early-exit.md).
**Baseline:** PRD US-10/FR-02, Feature Spec §4.2, Architecture membership/callable ownership, ADR-003 canonical syncEvents và SL-017 ingestion.
**Nguồn:** [PR #24](https://github.com/coder-fishing/DontLift-Mobile/pull/24).
**Execution scope:** Chỉ cập nhật kế hoạch, index và review report; không implement hoặc chạy runtime tests.

## PR24-4259164382

- **Status:** RESOLVED
- **Severity:** High
- **Category:** Early-exit ingestion cutoff ownership
- **Location:** SL-018 mục 2/3, Task 1/2, nghiệm thu/verification; shared ownership trong `docs/implementation-plan.md`.
- **Problem:** Plan hứa xử lý pending eligible events khi approve nhưng chỉ sở hữu early-exit callable. SL-017 chỉ kiểm tra room window; syncEvents có thể nhận event sau exit vào frozen score hoặc bác event trước cutoff đến muộn.
- **Recommendation:** Giao SL-018 mở rộng syncEvents, thêm per-member cutoff kiểm tra cùng transaction aggregate/receipt và boundary/concurrency/replay tests; giữ D3 gate cho semantics chưa được duyệt.
- **Created At:** 2026-10-13, review trên commit `973d4a9`.
- **Updated By:** Codex.
- **Updated At:** 2026-10-13, Asia/Saigon.
- **Review reference:** [P1 finding](https://github.com/coder-fishing/DontLift-Mobile/pull/24#discussion_r4259164382).
- **Response:** Đã đối chiếu inventory SL-018 và room-window-only validation SL-017, xác nhận thiếu ingestion owner. SL-018 nay sở hữu `functions/src/sync-events.cjs` và `functions/tests/early-exit-sync.test.cjs`; Task 1 yêu cầu transaction đọc cutoff cùng aggregate/receipt, Task 2 và nghiệm thu bao phủ pending pre-cutoff, đúng cutoff, duration qua cutoff, post-cutoff trong room window, hai thứ tự commit approval/ingestion và duplicate delivery. Post-cutoff không sửa frozen stats/settlement; eligible pre-cutoff không bị bác chỉ vì EARLY_EXIT. D3 tiếp tục chặn timestamp/boundary, late-event finality và ACK semantics; không tự duyệt policy hoặc thêm wire fields.

## Self-review

- Ownership trong plan và index khớp; test target có verification command, acceptance và dependency SL-017.
- Không viết implementation/signatures/tests vào plan; không chọn policy thay human, không sửa accepted API/ADR hoặc phê duyệt P6.2.
- Finding resolved ở mức plan; Functions/emulator/device behavior còn chưa kiểm chứng.
