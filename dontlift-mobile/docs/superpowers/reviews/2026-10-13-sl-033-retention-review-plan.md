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
- **Response:** Tại thời điểm correction cũ, SL-033 sở hữu đăng ký ba jobs. Finding mới PR24-4259477708 loại receipt cleanup job theo ADR-003; hiện chỉ còn hai jobs đúng trong `functions/index.js`, discovery kiểm tra cả hai. D10/E2 và deployment configuration vẫn là prerequisites, chưa có deploy evidence.

## Self-review

- Dependency graph remains acyclic; local lifecycle caller uses the existing app root, and receipt TTL follows the approved architecture mechanism.
- Local purge and receipt timestamp remain planned only; D10/E2 and applied TTL policy are release gates.
- Receipt TTL does not replace Solo-summary purge or settlement-details cleanup.

## PR24-4259477698

- **Status:** RESOLVED
- **Severity:** High
- **Category:** Local retention runtime trigger
- **Location:** SL-033 mục 3/5/6/7.
- **Problem:** Service `local-retention.ts` không có planned app lifecycle caller, nên local Free logs có thể không bị purge khi app được mở lại sau hạn lưu.
- **Recommendation:** Gọi purge sau database readiness khi cold start và khi app resume; test restart cùng age boundary.
- **Created At:** 2026-10-13, review trên commit `45d52aa`.
- **Updated By:** Codex.
- **Updated At:** 2026-10-13, Asia/Saigon.
- **Review reference:** [P1 finding](https://github.com/coder-fishing/DontLift-Mobile/pull/24#discussion_r4259477698).
- **Response:** SL-033 giao `src/app/_layout.tsx` gọi local purge sau database readiness ở cold start/resume, cùng lifecycle tests cho startup, resume, restart và age boundary; pending/failed outbox không bị purge. [AGENTS.md dòng 32–33](../../../AGENTS.md#L32-L33) xác định repository là prototype và kiến trúc mục tiêu không chứng minh adapter/caller đã tồn tại.

## PR24-4259477708

- **Status:** RESOLVED
- **Severity:** Medium
- **Category:** Receipt retention mechanism
- **Location:** SL-033 mục 3/5/6/7; SL-037 deployment plan; shared ownership/index.
- **Problem:** `receipt-retention.cjs` tạo scheduled cleanup mới, thay Firestore TTL mà architecture đã duyệt và mở rộng ba scheduled jobs chưa có ownership TTL deployment.
- **Recommendation:** Stamp TTL timestamp trên sync receipt và giao TTL enablement/config evidence cho SL-037.
- **Created At:** 2026-10-13, review trên commit `45d52aa`.
- **Updated By:** Codex.
- **Updated At:** 2026-10-13, Asia/Saigon.
- **Review reference:** [P2 finding](https://github.com/coder-fishing/DontLift-Mobile/pull/24#discussion_r4259477708); [Firestore TTL documentation](https://firebase.google.com/docs/firestore/ttl).
- **Response:** SL-033 bỏ receipt cleanup Function, mở rộng `syncEvents` ghi server-time `expiresAt` trong transaction theo horizon D10; SL-037 xác nhận policy `syncReceipts/expiresAt` qua Cloud Console/gcloud trên database được phép và lưu evidence. TTL không hứa xóa đúng thời điểm, không xóa domain data. [AGENTS.md dòng 15–16](../../../AGENTS.md#L15-L16) giữ accepted architecture/ADR ở trên plan cũ.
