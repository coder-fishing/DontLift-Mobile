# Review kế hoạch — SL-033

**Target:** [Plan](../plans/2026-10-13-sl-033-retention.md).
**Baseline:** `settlementDetails/current` producer and expiry behavior are owned by SL-023.
**Nguồn:** [PR #24](https://github.com/coder-fishing/DontLift-Mobile/pull/24), reviewed commit `4e681b6`.
**Execution scope:** Chỉ sửa hard dependency/index/report; không triển khai cleanup.

## PR24-4256183831

- **Status:** RESOLVED
- **Severity:** Medium
- **Category:** Settlement-details producer dependency
- **Location:** SL-033 required dependencies and implementation-plan row.
- **Problem:** SL-033 cleans `settlementDetails/current` and depends on its `expiresAt` behavior, but did not depend on SL-023, which creates that resource.
- **Recommendation:** Add SL-023 as a hard dependency so cleanup cannot precede its resource and expiry producer.
- **Created At:** 2026-10-13, PR #24 review on commit `4e681b6`.
- **Updated By:** Codex, after user requested continuing the corrections.
- **Updated At:** 2026-10-13, Asia/Saigon.
- **Review reference:** [P2 finding](https://github.com/coder-fishing/DontLift-Mobile/pull/24#discussion_r4256183831).
- **Response:** SL-033 and the P6.1 dependency index now include SL-023. No retention duration or product behavior changed; D10 remains open.

## PR24-4256559436

- **Status:** RESOLVED
- **Severity:** High
- **Category:** Scheduled Functions registration
- **Location:** SL-033 mục 3, Task 2, acceptance và verification.
- **Problem:** Ba retention job chỉ được liệt kê dưới dạng module độc lập, không có entrypoint export nên không được Firebase discover/deploy.
- **Recommendation:** Giao SL-033 đăng ký ba schedule và thêm discovery test.
- **Created At:** 2026-10-13, PR #24 review.
- **Updated By:** Codex, theo yêu cầu tiếp tục sửa review findings.
- **Updated At:** 2026-10-13, Asia/Saigon.
- **Review reference:** [P1 finding](https://github.com/coder-fishing/DontLift-Mobile/pull/24#discussion_r4256559436).
- **Response:** SL-033 hiện sở hữu đăng ký cả ba jobs trong `functions/index.js` và kiểm tra discovery. Test xác nhận đủ scheduled exports nhưng không quyết định retention policy/cadence; D10/E2 và deployment configuration vẫn là prerequisites riêng. Finding được resolved ở plan level, chưa có deploy evidence.

## Self-review

- Dependency graph remains acyclic; SL-023 already depends on SL-020, not SL-033.
- Finding is resolved at plan level only; retention cleanup is not implemented.
- Yêu cầu entrypoint/discovery retention đã có trong SL-033; D10/E2 vẫn chưa giải quyết, và correction này không quyết định cadence hay deployment configuration.
