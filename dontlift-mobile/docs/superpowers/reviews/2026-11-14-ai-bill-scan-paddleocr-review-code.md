# Code Review — Quét hóa đơn bằng PaddleOCR

**Target:** Phần quét hóa đơn trong `D:\premium-api\src\routes\receipt-scan.js`, `src\services\receiptScanService.js`, `src\repositories\receiptScanRepository.js`, cùng mobile client, màn hình chia hóa đơn, quyền Expo, test và contract liên quan.
**Baseline:** Plan đã được duyệt `docs/superpowers/plans/2026-11-14-ai-bill-scan-paddleocr.md`.
**Scope:** Đối chiếu implementation đã commit với luồng PaddleOCR trong plan.

## Kết quả

RC-001 đã được xử lý. Nội dung quyền camera trong cả hai Expo plugin giờ giữ mục đích quét QR và chụp hóa đơn; các phần scan API, kiểm tra entitlement/Host, xác nhận gợi ý hóa đơn và nhập thủ công cũng phù hợp với plan.

## Vấn đề

### RC-001 — Giữ mục đích quét QR trong thông báo quyền camera iOS

- **Status:** RESOLVED
- **Severity:** Medium
- **Category:** Cấu hình / trải nghiệm quyền truy cập
- **Location:** `app.json` → `expo.plugins[2]` (`expo-image-picker`).cameraPermission
- **Problem:** Plugin `expo-camera` đặt `NSCameraUsageDescription` để giải thích cả việc quét QR vào phòng và chụp hóa đơn, nhưng plugin `expo-image-picker` chạy sau lại đặt cùng khóa iOS thành thông báo chỉ nói về chụp hóa đơn. Source plugin của Expo xác nhận image-picker ghi khóa `NSCameraUsageDescription`, nên lời nhắc iOS được sinh ra không còn giải thích mục đích quét QR mời vào phòng hiện có.
- **Recommendation:** Đặt `expo-image-picker.cameraPermission` bằng cùng nội dung tiếng Việt kết hợp với `expo-camera.cameraPermission`, để lời nhắc quyền iOS giữ cả hai mục đích.
- **Created At:** 2026-11-14
- **Updated By:** Codex
- **Updated At:** 2026-11-14
- **Response:** Đã cập nhật `expo-image-picker.cameraPermission` dùng cùng nội dung kết hợp với `expo-camera.cameraPermission`, giữ cả quét QR vào phòng và chụp hóa đơn. `pnpm exec expo config --type public` thành công và hiển thị cùng nội dung ở cả hai plugin.

## Giới hạn xác minh

- Test API scan hóa đơn và bill screen đạt: 2 suites, 26 tests; suite API mobile cũng đã chạy riêng và đạt 9 tests.
- 18 backend scan tests đạt. Toàn bộ backend có 37 tests đạt, một lỗi catalog calendar đã tồn tại trước đó, và một Firestore integration test bị bỏ qua.
- `pnpm exec tsc --noEmit` báo các lỗi có sẵn ở screen/hook không liên quan và kiểu test của profile screen; không có diagnostics trỏ tới scan client hoặc screen.
- Lệnh phân giải Expo public config thành công. Chưa xác minh trên thiết bị Android/iOS vì môi trường không có thiết bị kết nối.

## Tự kiểm tra báo cáo

- Xác nhận đây là review report duy nhất cho plan slug đã duyệt.
- Đối chiếu lại source Expo plugin và các chuỗi quyền được nêu trong RC-001.
- RC-001 đã được xử lý trong feedback mode; source và report cùng phản ánh nội dung quyền kết hợp.
- Ghi rõ giới hạn backend test, TypeScript và xác minh thiết bị, không nhận là các bước đó đã đạt.
