# Redesign phần nội dung Group Active

**Trạng thái:** Người dùng duyệt plan và triển khai ngày 2026-11-11.
**Plan slug:** `2026-11-11-group-active-session-redesign`.
**Nguồn:** `prompts/redesign-group-active-session.prompt.md` và `design/references/screenshots/group-active-session-redesign-v1.png`.
**Skills:** ui-ux-pro-max, antislop DURING, react-native-expert, qskill-writing-plans, qskill-executing-plans; review các ràng buộc theo checklist review-plan.

## Phạm vi và kết quả kiểm tra

Chỉ sửa nội dung `GroupActiveScreen.tsx`, test màn hình và khoảng cách đầu body riêng của `06-group-active` trong caller nếu cần. Không sửa Header, BottomNav, sensor, scoring, repository, Rules hay dependency. Không commit/push/deploy.

GlassCard có View nội dung riêng nên đặt gap/flex trên card không giãn đúng các phần tử bên trong. Các nút cần bề mặt tĩnh và View hàng rõ ràng. isOnline chỉ đủ để hiển thị Online/Offline. Hàm rankGroupMembers chỉ lấy ACTIVE, xếp điểm rồi UID; giữ nguyên. Avatar được lấy từ snapshot gốc theo UID, không đổi hàm domain.

## File và trách nhiệm

- `src/screens/GroupActiveScreen.tsx`: timer gradient, phone state, thông báo, vote panel, roster compact và các hành động.
- `src/app/index.tsx`: chỉ paddingTop riêng Group Active; giữ scroll owner và clearance cuối hiện có.
- `__tests__/group-active-screen.test.tsx`: kiểm tra trạng thái, callbacks, permissions, xác nhận và dữ liệu động.
- Component helper cục bộ: avatar fallback và chỉ số nếu có dùng lặp; không sửa shared components toàn app.

## Task 1 — Timer và trạng thái điện thoại

- [x] Timer nổi bật, số tabular; dùng theme gradient và caption Time elapsed.
- [x] Badge Online/Offline, không suy diễn server-confirmed Live từ kết nối.
- [x] UNKNOWN → Checking position…, FACE_DOWN → Face down, LIFTED → Phone lifted, INVALID → Position unavailable.
- [x] Hai cột Confirmed lifts / Time away; giữ grace period.
- [x] Lỗi persistence/sensor hiển thị riêng; chỉ số local có cảnh báo chưa được xác nhận đầy đủ, không đổi logic ghi/đếm.
- [x] Early-exited dùng số liệu saved member, không dùng số đo mới.

## Task 2 — Roster compact

- [x] Hàng gọn, avatar/chữ Unicode, tên, YOU, lifts và điểm căn phải; giữ xếp hạng hiện tại.
- [x] Tên dài/font lớn cho phép tăng chiều cao; ảnh lỗi fallback.
- [x] Roster rỗng có thông báo chờ; không tạo ScrollView lồng nhau.

## Task 3 — Các hành động

- [x] Vote OPEN nằm gần timer/phone trước roster; vote idle ở vùng hành động sau roster.
- [x] Giữ mọi điều kiện hiện tại của vote, own ballot, countdown tham khảo, outcomes/errors và retry; không thay eligibility.
- [x] Request to leave chỉ Member ACTIVE; giữ confirm/callback/pending/offline.
- [x] Host Approve/Deny giữ quyết định, busy, errors.
- [x] End group session chỉ Host theo điều kiện hiện tại; giữ confirm/busy/errors và hậu quả sync điểm.
- [x] Nút rõ nền/viền, icon/chữ cùng hàng, tối thiểu 44dp. Không thêm retry không có callback.

## Task 4 — Kiểm tra

- [ ] Host/member; active/early-exited; online/offline; orientation/grace/error/sync.
- [ ] Vote idle/open/voted/finished/error; pending exit request/approval; completion busy/error.
- [ ] Avatar lỗi, tên dài, roster rỗng/dài, font lớn, nút cuối không bị che.
- [x] Chạy `pnpm test -- --runInBand __tests__/group-active-screen.test.tsx __tests__/group-active.test.ts`.
- [x] Chạy `pnpm exec tsc --noEmit` và `pnpm run lint`; báo rõ lỗi baseline.
- [ ] Kiểm tra Android/iOS nào có sẵn; không báo PASS cho thiết bị chưa kiểm tra.

## Rà soát plan trước triển khai

Đã xử lý các khác biệt giữa reference và contract: dùng Online thay Live; không đồng hạng lại; không gộp early exit, termination vote và Host completion. Scroll ngoài hiện có giữ paddingBottom 115 + safe area; chỉ bổ sung khoảng cách đầu body nếu cần. Không có quyết định sản phẩm mới đang chờ.

## Kết quả thực hiện

- Đã hoàn thành Task 1–3. Chỉ đổi GroupActiveScreen, test và paddingTop riêng body Group Active. Header/BottomNav không đổi.
- Hai suite Group Active: 10 test đạt, bao gồm confirm/callback, quyền Host/Member, vote own ballot, offline/persistence error, early-exit saved score và avatar fallback.
- ESLint riêng GroupActiveScreen đạt. Lint toàn repo báo 45 errors/31 warnings tại lần chạy; đã sửa cảnh báo purity cũ trong màn này bằng lazy state initializer. TypeScript toàn repo chưa đạt do lỗi hiện hữu (Profile test typings, nativeFeedbackAdapters, StatusBar/ref types và các màn khác); không có lỗi tại GroupActiveScreen hoặc test Group Active.
- Chưa kiểm tra giao diện iOS/Android thực tế; không có adb khả dụng trong PATH của môi trường. Font lớn, roster dài và khoảng che thực tế của shell còn cần xác nhận trên thiết bị.
- Không commit, push hay deploy.
