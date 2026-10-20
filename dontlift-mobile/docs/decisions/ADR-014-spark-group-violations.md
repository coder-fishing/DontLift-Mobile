# ADR-014: Ghi nhận group violation trên Firebase Spark

## Status

Accepted — human approval 2026-10-20.

## Context

SL-017 phải lưu local confirmed violations khi offline và cập nhật leaderboard realtime. ADR-003 chọn `syncEvents`/Cloud Functions làm ingestion authority, nhưng Functions Cloud deployment cần Blaze trong khi project phải tiếp tục ở Spark. Firestore client transactions không queue khi offline; SQLite/outbox giữ event cho đến khi có mạng.

## Decision

- Tiếp tục dùng ADR-008 để xác nhận violation: candidate bị hủy nếu foreground trở lại trước 3 giây; event chỉ được tạo sau grace period và recovery rules của platform.
- Mỗi event có UUID ổn định, gắn với room và actor Auth hiện tại. App ghi local violation cùng outbox row atomically. Offline capture không ghi vào Firestore queue.
- Khi online, client dùng một Firestore transaction được Rules giới hạn. Transaction đọc room, own member và violation document theo event ID; transaction mới chỉ được chấp nhận cho member đang `ACTIVE` trong room đang `ACTIVE`, với interval bắt đầu không trước `startedAt`, kéo dài ít nhất ba giây, kết thúc không sau `request.time`, và duration khớp interval theo giây floored.
- Transaction tạo violation document bất biến dưới room và cập nhật đúng member actor. Member ghi `lastViolationEventId` để Security Rules chứng minh event và aggregate được commit cùng nhau. Một event tăng `liftCount` lên một, cộng `durationSeconds` vào `violationDurationSeconds`, và giữ invariant `penaltyScore = liftCount * 10 + violationDurationSeconds`.
- Rules chỉ cho phép cặp create-event/update-own-member này khi cả hai thay đổi xuất hiện trong cùng transaction và khớp chính xác; Rules từ chối sửa/xóa violation, sửa điểm tùy ý, hoặc ghi thay member khác.
- Violation document ID là idempotency key. Replay cùng ID và payload trả lại outcome đã ghi mà không tăng score; cùng ID với payload khác bị từ chối.
- Firestore listener đọc room violations cho member cùng room; leaderboard đọc member documents hiện hữu và sắp tăng dần theo `penaltyScore`. Nếu nhiều member bằng điểm, `uid` tăng dần làm tie-break ổn định.
- Nếu room không còn `ACTIVE`, client giữ event ở `PENDING` và không sửa cloud state. SL-020 phải mở reconciliation cho event có `endedAt` trước room end theo ADR-003; event không được tự đánh dấu `FAILED` chỉ vì room đã hoàn tất.
- Không dùng Cloud Functions cho group violation transaction; không bật billing. Firestore usage vẫn chịu quota Spark.

## Security boundary

Rules xác nhận Auth UID, active membership, room lifecycle, event shape/time bounds, immutable event identity, atomic aggregate delta, và score formula. Sensor evidence vẫn do thiết bị ghi nhận; một member chỉ có thể làm tăng penalty của chính họ, không thể giảm điểm hay sửa điểm member khác.

## Consequences

### Positive

- Group violation capture và leaderboard dùng Firestore Spark, không cần Functions deployment.
- Offline event vẫn bền vững trong SQLite/outbox; reconnect dùng exact transaction online.
- Event và score thay đổi nguyên tử, có idempotency bằng event ID; listener dùng resource room/member đã có.

### Negative

- Rules/tests phức tạp hơn và phải xác minh qua Firestore Emulator trước khi deploy.
- Transaction cần online; offline event chưa đồng bộ vẫn chỉ là local pending preview.
- SL-020 phải hoàn thiện xử lý event pending có thời gian trước room end sau khi phòng completed; không thể final hóa room bỏ qua pending member events theo ADR-003.
- Firestore free quotas vẫn áp dụng; Spark không có billing fallback khi quota cạn.

## Alternatives considered

- Cloud Function `syncEvents`: giữ ADR-003 boundary, nhưng Cloud Functions deployment yêu cầu Blaze; không phù hợp với yêu cầu Spark.
- Client ghi event và score bằng các writes độc lập: loại vì event/aggregate có thể lệch nhau và replay có thể cộng trùng.
- Client sửa arbitrary score hoặc leaderboard aggregate: loại vì không ràng buộc score với event của chính member.

## Source

- Human approval trong cuộc trò chuyện SL-017, 2026-10-20: giữ Spark, dùng transaction Firestore do Rules kiểm soát; không dùng Functions/billing.
- [ADR-003](ADR-003-authoritative-command-boundary.md), [ADR-008](ADR-008-platform-session-lifecycle.md), [API contract group violation](../api-contracts.md#51-group-violation-firestore-transaction-spark).
