# Solo Summary Sync Trực Tiếp Lên Firestore

**Status:** Design approved by the user on 2026-11-14 for personal-history data that may be submitted by the signed-in client. Implementation has not started.

## Mục tiêu

Đồng bộ Solo summary từ SQLite/outbox lên Cloud Firestore bằng Firebase JS client SDK, bỏ lời gọi Cloud Function `syncEvents` khỏi luồng sync Solo mới. Summary vẫn lưu local trước; khi có mạng, thiết bị đang đăng nhập đúng tài khoản sẽ ghi summary của mình lên Firestore để Solo History trên thiết bị khác có thể đọc.

Solo summary chỉ là lịch sử cá nhân. Người sở hữu tài khoản có thể tự gửi số liệu; Firestore Rules kiểm tra người gửi và hình dạng dữ liệu nhưng không chứng minh dữ liệu sensor là trung thực. Summary này không được dùng làm điểm leaderboard, phần thưởng, premium entitlement hoặc dữ liệu canonical của phiên nhóm.

## Trạng thái hiện tại và thay đổi kiến trúc

- `createSoloSyncWorker` lấy `SOLO_SESSION_COMPLETED` từ SQLite `sync_outbox`; `createSyncEventsPort` gửi batch qua callable Function `syncEvents`.
- Function hiện ghi `users/{uid}/sessions/{sessionId}` và `users/{uid}/syncReceipts/{eventId}` bằng transaction, đồng thời kiểm tra payload, payload hash và trùng event.
- `firestore.rules` cho owner đọc `users/{uid}/sessions`, nhưng hiện deny mọi create/update/delete từ client.
- Solo History đọc collection `users/{uid}/sessions`; schema đọc hiện có gồm thời lượng, lift count, thời gian vi phạm, điểm phạt, thời điểm bắt đầu và kết thúc.
- Repository convention và ADR-003 hiện coi `syncEvents` là authority cho event ngoại tuyến. Thiết kế này tạo ngoại lệ rõ ràng chỉ cho `SOLO_SESSION_COMPLETED`; các lệnh nhóm, thanh toán, entitlement và event loại khác không đổi.

## Hợp đồng dữ liệu và ghi Firestore

- Giữ document path `users/{uid}/sessions/{sessionId}` để Solo History, cursor pagination và cache hiện tại tiếp tục đọc được.
- Dùng `sessionId` làm document ID ổn định và idempotency key. Payload summary giữ các trường hiện tại: `durationSeconds`, `liftCount`, `violationDurationSeconds`, `penaltyScore`, `startedAt`, `completedAt`, `payloadHash` và `createdAt`.
- `startedAt`/`completedAt` là Firestore Timestamp; `createdAt` dùng server timestamp. Hash được tạo theo đúng canonical event contract hiện có để Function cũ có thể nhận ra cùng payload trong giai đoạn chuyển tiếp.
- Transport trực tiếp xác nhận người đăng nhập vẫn là `uid` của worker rồi chạy Firestore transaction trên document summary:
  1. Nếu document chưa tồn tại, tạo document theo schema trên.
  2. Nếu document đã tồn tại và `payloadHash` trùng, trả kết quả đồng bộ thành công mà không ghi lại.
  3. Nếu ID trùng nhưng hash khác, trả lỗi permanent `already-exists`; không ghi đè document.
- Transaction và document ID xác định làm cho retry sau mất mạng không tạo thêm summary. Firestore transaction yêu cầu online; khi offline worker giữ outbox pending và thử lại khi app/network hoạt động.

## Security Rules và quyền dữ liệu

- Owner chỉ được đọc/list summary ở `users/{uid}/sessions` của chính mình.
- Client chỉ được tạo summary khi `request.auth.uid == uid`; client không được update hoặc delete summary.
- Rule kiểm tra allowlist field, kiểu dữ liệu, UUID/document ID, miền số hợp lệ, thứ tự timestamp và giới hạn hợp lý của các trường summary. Không có quyền ghi sang UID khác.
- `payloadHash` chỉ hỗ trợ phát hiện trùng/xung đột, không phải bằng chứng về độ trung thực. Vì đây là lịch sử cá nhân, owner có thể ghi số liệu tự khai của chính mình.
- Trước khi thay Rules hoặc SDK behavior, xác minh database `(default)` của project `august-monument-508716-u0` là Firestore Standard. Nếu là Enterprise, dừng và rà lại SDK cùng hướng dẫn edition trước khi tiếp tục. Firebase CLI có trong repo nhưng lần gọi list database thất bại vì refresh token hết hạn và network không tới Google; chưa xác nhận được edition.

## Outbox, retry và phục hồi dữ liệu

- SQLite session/summary/outbox vẫn commit nguyên tử và tiếp tục là dữ liệu local-first. Firestore cache không thay outbox.
- Worker status tiếp tục là `PENDING` khi offline/retryable, `SYNCED` sau khi Firestore transaction xác nhận, và `FAILED` khi payload xung đột hoặc lỗi Rules permanent.
- Có thao tác retry cụ thể cho một session: đổi event `FAILED` về `PENDING`, xóa lease/backoff/error cũ, sau đó kick worker. Nút Retry gọi thao tác này trước khi sync; chỉ gọi `kick(ignoreBackoff)` là không đủ vì claim query hiện chỉ lấy PENDING.
- Khi transport mới khởi động, requeue các record `FAILED` cũ có `last_error_code = 'not-found'` từ callable cũ. Giữ `eventId`, `sessionId`, payload và số lần thử; ghi/xác nhận lại qua deterministic Firestore path để không làm mất summary local.
- Không tự requeue mọi lỗi permanent: `permission-denied`, payload sai và collision cần giữ nguyên trạng thái FAILED cho đến sửa Rules/dữ liệu hoặc người dùng chủ động retry.

## Rollout và tương thích

- Thay transport của Solo worker bằng direct Firestore, giữ worker, lease, backoff và outbox repository contract càng nguyên trạng càng tốt.
- Giữ callable `syncEvents` được deploy trong thời gian app cũ còn được dùng. Direct writer tạo cùng path và cùng `payloadHash` để Function cũ nhận diện document đã có nếu một client cũ gửi lại cùng session.
- Sau khi phát hành client mới và kiểm chứng không còn client dựa vào callable, cập nhật api contract/architecture/ADR rồi mới xem xét gỡ `syncEvents`. Việc dừng Function không nằm trong rollout đầu tiên.
- Firebase CLI tools are present locally, but cloud listing currently cannot authenticate because stored credentials expired and network access to Google endpoints is unavailable. Verify database edition and current deployment state in Firebase Console before release.

## Chi phí

- Client mới không gọi Cloud Function cho Solo summary. Mỗi summary cần một transaction với tối thiểu một document read và tối đa một document write; retry đọc lại cùng deterministic path.
- SQLite/outbox vẫn xử lý offline. Firestore reads, writes, storage và bandwidth vẫn chịu quota của Firestore; không cam kết Firestore không bao giờ phát sinh phí nếu project vượt quota miễn phí hoặc dùng tính năng cần billing.
- Không bật billing, tạo database mới, deploy Rules/Function hay thay đổi cloud resource trong phần implementation nếu chưa có yêu cầu riêng.

## Chấp nhận

- Hoàn tất Solo offline vẫn lưu summary/outbox local và UI không báo synced trước xác nhận server.
- Khi online, summary xuất hiện trong `users/{uid}/sessions/{sessionId}` và được Solo History đọc như trước.
- Sync lại cùng event/payload cho kết quả thành công idempotent; cùng ID với payload khác bị từ chối và không ghi đè.
- Người dùng không đọc/ghi summary của UID khác; client không update/delete summary đã tạo.
- FAILED `not-found` cũ được thử lại bằng direct Firestore; nút Retry thực sự chuyển record phù hợp về PENDING rồi kick worker.
- Lỗi offline được retry; `permission-denied` được giữ thành FAILED với mã lỗi để điều tra.
- Emulator coverage xác nhận Rules, owner boundaries, validation, retry, conflict, idempotency và đọc Solo History; device validation trên Expo Go xác nhận summary sync giữa hai lần cài/thiết bị cùng tài khoản.
- Không thay đổi dữ liệu canonical nhóm, group score, settlement, Premium hoặc các event khác.
