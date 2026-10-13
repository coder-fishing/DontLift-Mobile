# Review kế hoạch — SL-015

**Target:** [Plan](../plans/2026-10-13-sl-015-room-join-qr.md).
**Baseline:** US-07, Feature Specification §4.2, Expo SDK/native targets của repo và quy tắc dependency trong [AGENTS.md](../../../AGENTS.md#L59).
**Nguồn:** [PR #24](https://github.com/coder-fishing/DontLift-Mobile/pull/24).
**Human authorization:** 2026-10-13, user trả lời "ok" cho việc cập nhật ba kế hoạch theo finding mới.
**Execution scope:** Chỉ cập nhật plan và review report; không cài package, không sửa cấu hình app, không xác nhận native/device behavior.

## PR24-4255952623

- **Status:** RESOLVED
- **Severity:** High
- **Category:** Scanner dependency và native configuration ownership
- **Location:** SL-015 mục 3, Task 1/2 và mục 6.
- **Problem:** Slice yêu cầu camera permission, repeated-frame handling và scan thật giữa hai thiết bị, nhưng chỉ giao `app.json`; manifest và lockfiles không có scanner package nên theo file ownership hiện tại không thể tạo scanner có thể chạy.
- **Recommendation:** Giao việc chọn Expo-compatible scanner SDK, `package.json`, hai lockfile và cấu hình quyền/native cho SL-015; bổ sung kiểm tra dependency/configuration vào acceptance.
- **Created At:** 2026-10-13, theo PR review trên commit `bb406e4`.
- **Updated By:** Codex, theo human authorization "ok".
- **Updated At:** 2026-10-13, Asia/Saigon.
- **Review reference:** [P1 finding](https://github.com/coder-fishing/DontLift-Mobile/pull/24#discussion_r4255952623).
- **Response:** Finding được xác nhận: `package.json` không khai báo camera/QR scanner, và AGENTS.md yêu cầu đồng bộ `package-lock.json` cùng `pnpm-lock.yaml` khi thêm dependency. SL-015 hiện sở hữu lựa chọn SDK sau khi xác minh tương thích Expo/native targets, cả hai lockfile và cấu hình quyền/plugin cần thiết; test/acceptance kiểm tra configuration và scan hai thiết bị. D7 không áp dụng cho scanner này; E1 tiếp tục chặn nghiệm thu native/device nếu chưa có môi trường. Camera QR invitation được phân biệt rõ với camera-based phone detection ngoài scope.

## Self-review

- Đồng bộ batch v0.8: parser reuse contract/encoder SL-013; D13 chặn scheme/payload chưa duyệt và two-device acceptance bắt buộc scan QR do Host lobby render. Không dùng fixture để thay producer. Finding và response được theo dõi tại [SL-013 report](./2026-10-13-sl-013-room-create-review-plan.md#pr24-4256751986).

- Finding chỉ được đánh dấu resolved ở mức ownership trong kế hoạch; không khẳng định package đã được cài hay scanner đã chạy trên thiết bị.
- Quyền camera chỉ được xin khi người dùng mở scanner; QR banking và link sai scheme vẫn bị từ chối.
