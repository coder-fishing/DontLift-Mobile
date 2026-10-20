# ADR-013: Start room trên Firebase Spark bằng Firestore transaction

## Status

Accepted — human approval 2026-10-20.

## Context

SL-016 cần realtime đọc room/member và Host-only `WAITING → ACTIVE`. ADR-003 đặt shared-state mutations sau callable Cloud Functions, nhưng Cloud Functions deployment yêu cầu Blaze; sản phẩm đang giữ Firebase Spark. SL-013 và SL-014 đã có các ngoại lệ transaction hẹp được Security Rules kiểm tra.

## Decision

- `startRoom` dùng một Firestore JS client transaction online, được Security Rules giới hạn; không deploy Cloud Functions hoặc bật billing.
- Request gồm `version: 1`, UUIDv4 `requestId`, `roomId`; Auth UID chỉ lấy từ Firebase Auth.
- Chỉ `hostId` có membership `HOST`/`ACTIVE` được chuyển room `WAITING → ACTIVE`.
- Transaction chỉ sửa `status`, `startedAt`, `updatedAt`, `lastStartRequestId`; hai timestamp dùng `serverTimestamp()` và Rules đối chiếu `request.time`.
- `lastStartRequestId` trên room là idempotency marker cho lần start duy nhất. Cùng ID sau commit trả lại outcome đã lưu; ID khác khi room đã `ACTIVE` nhận `failed-precondition`. Không tạo receipt document mới.
- Rules là authority cho transition. Client không queue lệnh khi offline và không báo ACTIVE trước khi server transaction/snapshot xác nhận.
- Room/member realtime reads dùng Firestore listeners và membership Rules; khi thoát hoặc đổi room, subscriptions cũ phải được hủy.

## Consequences

### Positive

- SL-016 hoạt động trên Spark và không cần Cloud Functions deployment.
- Auth, Host role, lifecycle precondition, server timestamps và transition nguyên tử được Security Rules enforce.
- Realtime listeners vẫn dùng Firestore free quota; usage bị giới hạn bởi quota miễn phí và phải theo dõi.

### Negative

- Rules không trả application error code; lỗi race/authorization có thể hiện là `permission-denied`.
- Rules và tests có thêm một lifecycle exception; mọi field/update ngoài allowlist vẫn bị từ chối.
- Start yêu cầu online. Read/listener usage tăng theo roster và lần reconnect.
- Đây chỉ là boundary của SL-016; early-exit, votes, heartbeat và các command khác không được phép dùng client transactions theo quyết định này.

## Alternatives considered

- Callable Cloud Function: giữ boundary ADR-003 nhưng yêu cầu Blaze để deploy; không phù hợp với constraint Spark đã được duyệt.
- Client `updateDoc` không được bảo vệ chặt: loại vì dễ bỏ qua room state, Host membership, timestamp hoặc idempotency.
- Mở client update room tổng quát: loại; chỉ transition chính xác `WAITING → ACTIVE` được thêm.

## Source

- Human approval trong cuộc trò chuyện SL-016, 2026-10-20: giữ Spark, dùng Firestore transaction do Rules giới hạn.
- [ADR-003](ADR-003-authoritative-command-boundary.md), [ADR-004](ADR-004-firestore-ownership-and-rules.md), [API contract `startRoom`](../api-contracts.md#3-startroom--firestore-transaction-spark).
