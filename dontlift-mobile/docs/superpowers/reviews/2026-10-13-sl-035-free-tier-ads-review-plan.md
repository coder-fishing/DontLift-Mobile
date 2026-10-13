# Review kế hoạch — SL-035

**Target:** [Plan](../plans/2026-10-13-sl-035-free-tier-ads.md).
**Baseline:** Quy tắc dependency trong [AGENTS.md](../../../AGENTS.md#L59), UX §7.3 và D7 là blocker chọn ads provider.
**Nguồn:** [PR #24](https://github.com/coder-fishing/DontLift-Mobile/pull/24).
**Human authorization:** 2026-10-13, user trả lời "ok" cho việc cập nhật ba kế hoạch theo finding mới.
**Execution scope:** Chỉ cập nhật plan và review report; không chọn provider, cài SDK, thay app config hoặc kiểm thử ad thật.

## PR24-4255952642

- **Status:** RESOLVED
- **Severity:** High
- **Category:** Ads SDK dependency và native configuration ownership
- **Location:** SL-035 mục 2/3, Task 1/2 và mục 6/7.
- **Problem:** Sau khi D7 chọn provider, slice yêu cầu test-mode banner, placements và consent behavior nhưng danh sách file không giao manifest, native config hay hai lockfile; theo boundary hiện tại có thể chỉ làm eligibility logic mà không tích hợp được ad thật.
- **Recommendation:** Giao provider SDK/adapter, `package.json`, `app.json`, cả hai lockfile và test-mode/consent verification cho SL-035, vẫn giữ D7 chặn mọi lựa chọn hoặc config trước approval.
- **Created At:** 2026-10-13, theo PR review trên commit `bb406e4`.
- **Updated By:** Codex, theo human authorization "ok".
- **Updated At:** 2026-10-13, Asia/Saigon.
- **Review reference:** [P1 finding](https://github.com/coder-fishing/DontLift-Mobile/pull/24#discussion_r4255952642).
- **Response:** Finding được xác nhận: chưa có ads SDK trong manifest, và AGENTS.md yêu cầu cập nhật đồng bộ hai lockfile khi dependency thay đổi. SL-035 nay sở hữu provider adapter, lựa chọn SDK sau D7, `package.json`, `app.json` theo yêu cầu thực tế của SDK/consent policy, cả hai lockfile và xác nhận test mode trên Android/iOS. D7 vẫn là blocker; không có provider hay package nào được chọn hoặc cài trong lượt này.

## Self-review

- Finding được đánh dấu resolved ở mức ownership trong kế hoạch; không khẳng định ads SDK/native configuration đã được tích hợp.
- D7 tiếp tục chặn mọi lựa chọn provider, placement và consent policy còn chưa được duyệt.
