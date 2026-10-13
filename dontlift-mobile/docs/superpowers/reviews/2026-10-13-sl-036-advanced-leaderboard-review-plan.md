# Review kế hoạch — SL-036

**Target:** [Plan](../plans/2026-10-13-sl-036-advanced-leaderboard.md).
**Baseline:** ADR-007 đã chấp nhận Advanced Penalty Leaderboard là quyền lợi Server Premium; SL-037 phụ thuộc bắt buộc vào SL-036 và giữ D6.
**Nguồn:** [Finding trên PR #24](https://github.com/coder-fishing/DontLift-Mobile/pull/24#discussion_r4256674252), commit được review `52b3a79`.
**Execution scope:** Chỉ sửa plan/report; không triển khai leaderboard hoặc thay đổi product scope.

## PR24-4256674252

- **Status:** RESOLVED
- **Severity:** High
- **Category:** Release gate consistency
- **Location:** SL-036 Task 2, bước tích hợp số 2.
- **Problem:** SL-036 cho phép gỡ chính nó khỏi release prerequisite nếu feature bị defer, trái với accepted ADR-007 và dependency bắt buộc từ SL-037.
- **Recommendation:** Giữ SL-037 blocked cho tới khi D6 được giải quyết và SL-036 hoàn thành; chỉ thay release scope bằng quyết định sản phẩm/ADR được human duyệt.
- **Created At:** 2026-10-13, PR #24 review.
- **Updated By:** Codex, theo yêu cầu tiếp tục sửa review findings.
- **Updated At:** 2026-10-13, Asia/Saigon.
- **Review reference:** [P1 finding](https://github.com/coder-fishing/DontLift-Mobile/pull/24#discussion_r4256674252).
- **Response:** SL-036 Task 2 hiện giữ release gate: D6 chưa chốt hoặc SL-036 chưa hoàn thành thì SL-037 không được pass; plan không có quyền tự gỡ dependency. Thay đổi tuân theo [AGENTS.md, dòng 14–17](../../../AGENTS.md#L14-L17), giữ nguyên hard edge SL-037 → SL-036 và blocker D6. Finding được resolved ở plan level, chưa có implementation evidence.

## Self-review

- Không còn nhánh hướng dẫn defer để bỏ release gate.
- Deferred analytics/gamification không bị gộp với Advanced Penalty Leaderboard được ADR-007 chấp nhận.
