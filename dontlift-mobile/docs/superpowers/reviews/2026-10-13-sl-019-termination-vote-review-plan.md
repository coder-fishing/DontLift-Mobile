# Review kế hoạch — SL-019

**Target:** [Plan](../plans/2026-10-13-sl-019-termination-vote.md).
**Baseline:** SL-003 sở hữu Functions runtime bootstrap; SL-019 sở hữu callable vote và hành vi dọn vote hết hạn mới.
**Nguồn:** [Finding trên PR #24](https://github.com/coder-fishing/DontLift-Mobile/pull/24#discussion_r4256559404), commit được review `4452eaa`.
**Execution scope:** Chỉ sửa plan/report; không triển khai hoặc deploy Functions.

## PR24-4259341504

- **Status:** RESOLVED
- **Severity:** Medium
- **Category:** Early-exit voter eligibility
- **Location:** Dependency header, Task 1, acceptance và `docs/implementation-plan.md` row SL-019.
- **Problem:** SL-019 có thể chạy trước SL-018 và chỉ kiểm tra roster tĩnh; membership record còn tồn tại sau approved early exit nhưng người đó rời active voter pool. Nếu vẫn tính họ vào voter denominator thì những người còn hoạt động có thể không bao giờ đạt unanimity.
- **Recommendation:** Thêm hard dependency SL-018 và kiểm chứng interaction early-exit/vote.
- **Created At:** 2026-10-13, review trên commit `f1c4d53`.
- **Updated By:** Codex.
- **Updated At:** 2026-10-13, Asia/Saigon.
- **Review reference:** [P2 finding](https://github.com/coder-fishing/DontLift-Mobile/pull/24#discussion_r4259341504).
- **Response:** SL-019 nay phụ thuộc SL-018; acceptance yêu cầu approved early-exit Member vẫn được giữ trong session/history nhưng bị loại khỏi voter denominator, kể cả khi vote đã mở. D3 tiếp tục chặn wire và policy roster-change chi tiết chưa được duyệt; [AGENTS.md dòng 13–20](../../../AGENTS.md#L13-L20) giữ ADR/architecture/API làm nguồn ưu tiên.

## PR24-4256559404

- **Status:** RESOLVED
- **Severity:** High
- **Category:** Cloud Functions exports
- **Location:** SL-019 mục 3, Task 1–2, acceptance và verification.
- **Problem:** Hai callable và scheduled cleanup chỉ được mô tả thành module riêng, không có quyền sở hữu Functions entrypoint nên Firebase không discover/deploy chúng.
- **Recommendation:** Giao SL-019 đăng ký callable/scheduled exports trong entrypoint hiện có và thêm discovery test.
- **Created At:** 2026-10-13, PR #24 review.
- **Updated By:** Codex, theo yêu cầu tiếp tục sửa review findings.
- **Updated At:** 2026-10-13, Asia/Saigon.
- **Review reference:** [P1 finding](https://github.com/coder-fishing/DontLift-Mobile/pull/24#discussion_r4256559404).
- **Response:** File inventory và Task 1 giao SL-019 đăng ký hai callable cùng scheduled cleanup tại `functions/index.js`; Task 2/acceptance và verification có discovery test. Test không áp đặt cadence; expiry vẫn là logical expiry 30 giây theo architecture, D3 tiếp tục chặn phần contract vote còn mở. Đây là resolved ở plan level, chưa có deploy evidence.

## Self-review

- Mỗi module có entrypoint ownership và discovery coverage tương ứng.
- Không bịa schedule/cadence; D3 tiếp tục là blocker cho wire contract vote, không bị mở rộng thành blocker cadence.
- Dependency graph SL-017 → SL-018 → SL-019 không tạo cycle; early-exit integration giữ membership/history record.
