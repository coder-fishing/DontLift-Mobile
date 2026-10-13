# Review mục lục kế hoạch — P6.1

**Target:** [Implementation plan index](../../implementation-plan.md).
**Related targets:** [P6.1 prompt](../../../prompts/plan-next-slice.prompt.md), [P6.0 prompt](../../../prompts/p6.0-slice-decomposition.prompt.md).
**Baseline:** Changelog của index là lịch sử revision hiện hành của bộ P6.1 draft.
**Nguồn:** [Finding trên PR #24](https://github.com/coder-fishing/DontLift-Mobile/pull/24#discussion_r4256559445), commit được review `4452eaa`.
**Execution scope:** Sửa index/revision metadata, source precedence trong planning prompts và report; không thực thi prompt hoặc thay P6.0 backlog.

## PR24-4256559445

- **Status:** RESOLVED
- **Severity:** Medium
- **Category:** Draft revision metadata
- **Location:** Header và changelog của implementation plan.
- **Problem:** Header ghi DRAFT v0.2 dù changelog đã có correction batch v0.5, khiến reviewer có thể tham chiếu nhầm revision.
- **Recommendation:** Tăng header revision và thêm changelog entry cho batch sửa hiện tại.
- **Created At:** 2026-10-13, PR #24 review.
- **Updated By:** Codex, theo yêu cầu tiếp tục sửa review findings.
- **Updated At:** 2026-10-13, Asia/Saigon.
- **Review reference:** [P2 finding](https://github.com/coder-fishing/DontLift-Mobile/pull/24#discussion_r4256559445).
- **Response:** Header và changelog hiện cùng ở v0.12; trạng thái DRAFT và cảnh báo chưa được phê duyệt vẫn giữ nguyên. Backlog P6.0 không thay đổi.

## PR24-4256869025

- **Status:** RESOLVED
- **Severity:** High
- **Category:** Source precedence
- **Location:** Prompt P6.1 section 5 và cùng lỗi ở prompt P6.0.
- **Problem:** Prompt xếp PRD/design trước accepted ADR/architecture/API, có thể khôi phục behavior đã superseded.
- **Recommendation:** Đồng bộ ordering với AGENTS và tách scheduling priority khỏi approval override.
- **Created At:** 2026-10-13, review trên commit 39acc2e.
- **Updated By:** Codex, theo yêu cầu tiếp tục sửa findings.
- **Updated At:** 2026-10-13, Asia/Saigon.
- **Review reference:** [Finding](https://github.com/coder-fishing/DontLift-Mobile/pull/24#discussion_r4256869025).
- **Response:** Hai prompt nay dùng đúng thứ tự newer human-approved decisions → ADR → architecture → API → PRD → design → Feature Spec → historical context. Code/evidence xác nhận hiện trạng, không override target. Tuân [AGENTS.md dòng 13–20](../../../AGENTS.md#L13-L20); không execute P6.0 hoặc sửa canonical backlog.

## Self-review

- Header và changelog cùng phản ánh v0.12; các batch cũ giữ lịch sử revision riêng.
- Không tuyên bố approval cho backlog, kế hoạch hoặc implementation.
