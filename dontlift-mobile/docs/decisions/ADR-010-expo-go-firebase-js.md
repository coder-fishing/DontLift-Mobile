# ADR-010: Expo Go + Firebase JS SDK, Cloud Spark cho runtime hiện tại

## Status

Accepted — user approved 2026-10-18. Supersedes ADR-001 runtime choice and ADR-009 callable profile bootstrap.

## Decision

- Dùng Firebase JS SDK cho Auth và Firestore. Expo Go dùng cùng Web App config trong project Firebase đã chọn.
- Cloud là mặc định khi phát triển. pnpm run dev mở Expo Go qua LAN, không chạy adb reverse hoặc Java.
- Firebase SDK tự quản lý Auth persistence với AsyncStorage adapter trên Android/iOS. Không tự sao chép token vào SQLite hoặc tự triển khai refresh token.
- Firebase JS Firestore trên React Native chỉ có cache trong bộ nhớ; không coi đây là native persistent offline cache. SQLite tiếp tục giữ local profiles, Solo sessions và durable outbox theo các slice tương ứng.
- users/{uid} được bootstrap bằng transaction tạo-nếu-chưa-có. UID và email lấy từ Auth. Rules chỉ cho chủ tài khoản tạo đúng các field đã định, isPremium=false, createdAt/updatedAt bằng request.time. Client không có quyền update/delete/list profile hoặc ghi entitlement.
- Retry trả lại hồ sơ đã tồn tại, không thay tên, thời gian tạo hoặc Premium. Đọc xác nhận từ server rồi mới upsert SQLite. Không còn gọi completeRegistrationProfile Cloud Function hoặc tạo commandReceipts.
- Giữ recovery khi Auth thành công nhưng Firestore/SQLite chưa hoàn tất. Giữ serialization giữa signIn và auth-state callback.
- Emulator là lựa chọn riêng cho local validation; production không được trỏ emulator và vẫn cần project tách biệt theo runtime guard hiện có.

## Scope and limits

Migration này thay runtime, Auth và profile bootstrap đang có, giữ SL-005 sensors và SL-006 SQLite/Solo. Room vẫn là prototype và cần các slice SL-013+; không mở Rules cho room trong migration này.

Các callable cho scoring, room lifecycle, sync hoặc Premium trong kế hoạch cũ là thiết kế tương lai, không phải đã chạy trên Spark. Khi triển khai cần quyết định backend và billing riêng. Việc bỏ callable profile không chuyển các quyền authoritative đó cho mobile client.

Auth email/password và Firestore dùng hạn mức miễn phí Spark. Cloud Functions không nằm trong runtime này. Khi cần phát hành Play Store vẫn cần build AAB; Expo Go phục vụ phát triển.

## Data continuity

Giữ Firebase project và dữ liệu cloud hiện có. Dữ liệu emulator không tự chuyển sang cloud; tài khoản đã tạo trong emulator phải đăng ký trên cloud. Expo Go có sandbox lưu trữ riêng nên cần đăng nhập lại, không xóa database của development client cũ.
