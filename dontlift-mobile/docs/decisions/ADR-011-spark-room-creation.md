# ADR-011: Tạo room trên Firebase Spark bằng Firestore Security Rules

## Status

Accepted — human approval 2026-10-20.

## Context

SL-013 cần tạo room, reserve PIN, thêm Host membership, tăng monthly quota và ghi idempotency receipt nguyên tử. SL-013 phải chạy với Firebase Spark, không bật Cloud Billing. Cloud Functions deployment cần Blaze, còn Firestore client transactions và Security Rules dùng được trong Spark quota.

## Decision

- Riêng `createRoom`, app dùng một Firebase JS Firestore transaction. Những callable khác tiếp tục theo ADR-003.
- Security Rules là server enforcement boundary: derive Host từ `request.auth.uid`; validate exact fields; chỉ cho create, không cho client update/delete; dùng `getAfter()` để bắt room, Host membership, unique PIN, quota counter và receipt cùng commit.
- App tạo UUID request/room IDs và đề xuất PIN candidate. Reservation `roomPins/{pin}` create-only bảo đảm PIN không thể bị ghi đè. PIN collision làm transaction fail hoàn toàn; Host có thể retry an toàn.
- Rules dùng `request.time` làm clock authority và tính đầu tháng theo `Asia/Ho_Chi_Minh` bằng UTC+07:00. Client đọc một server-time probe trước transaction để chọn đúng bucket; Rules vẫn xác minh bucket tại thời điểm commit.
- Quota projection là `users/{uid}/usage/current`, gồm `bucketStart` và `count`. Rules chỉ chấp nhận tăng đúng một lần hoặc reset về 1 khi bucket server đổi tháng; Free Host bị giới hạn 7.
- Receipt `users/{uid}/commandReceipts/{requestId}` chứa `roomId`, `pin`, `hostId`, trạng thái và thời điểm tạo trong cùng transaction. Replay cùng request/payload trả kết quả cũ; tái sử dụng request ID với room hoặc PIN khác bị từ chối.
- Local SQLite chỉ được cập nhật sau khi Firestore commit thành công. Offline create không queue.
- Room mới có `lastJoinRequestId: null`; SL-014 chỉ thay field này cùng `participantCount` khi tạo Membership và receipt để Rules chống tăng count lặp.
- Server-time probe dùng transaction đọc/ghi clock thay cho `setDoc` để không queue write offline. Toàn bộ probe có deadline 10 giây; khi hết hạn, kết quả probe trả muộn không được tiếp tục sang giao dịch tạo room. Người dùng phải bấm thử lại, giữ request ID cũ để kiểm tra receipt.
- Canonical invite URI là `dontliftmobile://room/{PIN}`; PIN mới là chuỗi tám chữ số và giữ mọi số 0 đầu. Phòng đã tạo theo contract cũ có thể vẫn chứa PIN bốn chữ số.

## Consequences

### Positive

- SL-013 chạy trên Spark mà không yêu cầu Functions deployment hoặc billing account.
- Auth UID, server time, uniqueness, quota và atomic document relationships vẫn được enforce trên Firebase server.
- Cloud Firestore realtime reads tiếp tục hoạt động theo free quota; realtime lobby vẫn thuộc SL-016.

### Negative

- Rules có nhiều invariant hơn và phải được kiểm tra bằng Emulator Suite cho cả allowed/denied transactions và access-call limits.
- Create room cần online; Rules chỉ validate giao dịch và không trả callable error codes. Client cần phân loại quota/collision/retry từ trạng thái đã đọc.
- Server-time probe tốn thêm một Firestore write/read trong mỗi attempt.
- PIN reservation hiện không được tự giải phóng trong SL-013; lifecycle/retention slice cần định nghĩa release policy trước khi PIN có thể tái sử dụng.
- `joinRoomByPin` và các authoritative commands khác vẫn cần quyết định kiến trúc riêng nếu toàn bộ app phải ở Spark.

## Alternatives considered

- Cloud Function `createRoom`: giữ API callable hiện tại nhưng không deploy được trên Spark.
- Direct unvalidated Firestore writes: loại vì client có thể giả UID, quota, Host membership hoặc ghi room/PIN không nhất quán.

## Source

- Human approval of Firebase Spark, D12, D13 and the Rules-authorized transaction design, 2026-10-20.
- Firebase Firestore transactions and Security Rules `getAfter()` documentation.
