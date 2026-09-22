# ADR-003: Authoritative command boundary và room completion reconciliation

## Status

Accepted

## Context

Firestore là nguồn sự thật cho shared state. Client không được authoritative đối với lifecycle, scores, quota hoặc bill. Realtime reads cần latency thấp, nhưng direct client writes làm business invariants phân tán vào Security Rules và tạo hai offline write queues.

Unexpected network loss tạo thêm một finality problem: Host có thể complete room trước khi offline Members giao hết pending violations. Tính bill ngay sẽ bỏ event hợp lệ; chờ vô hạn sẽ deadlock settlement.

## Decision

Dùng hybrid boundary:

- Client đọc và nghe Firestore trực tiếp theo Security Rules.
- Shared-state mutations đi qua callable Cloud Functions.
- Offline queue chỉ chứa allowlisted facts/events, không chứa state-dependent commands.
- Commands có `requestId`; events có `eventId`.

`completeRoom` thực hiện `ACTIVE → COMPLETED` nhưng mở `reconciliationStatus = PENDING`. Mỗi Member flush eligible events đến room `endedAt`, rồi gửi sync acknowledgment.

Final score được khóa khi:

1. Mọi relevant Member đã acknowledgment: `ALL_SYNCED`; hoặc
2. Host xác nhận override sau khi thấy danh sách Member chưa sync: `HOST_OVERRIDE`.

Bill calculation bị chặn đến khi reconciliation `FINALIZED`. Late event hợp lệ sau Host override vẫn được lưu vào history nhưng được đánh dấu excluded và không thay đổi score snapshot hoặc bill đã khóa.

Termination vote dùng authoritative `expiresAt`. Ballot sau expiry bị từ chối ngay cả khi physical cleanup chưa chạy.

## Consequences

### Positive

- Lifecycle, quota và bill invariants nằm trong một server boundary.
- Realtime reads không chịu Functions proxy latency.
- Pending Member data có cơ hội vào final score.
- Host override tránh settlement deadlock mà không dùng timeout tùy ý.
- Bill/VietQR không thay đổi âm thầm sau finalization.

### Negative

- Callable commands cần network.
- Functions dùng Admin SDK nên phải tự authorization, không được dựa vào Rules.
- Host override có thể loại late violations khỏi final score.
- Completion UI cần hiển thị reconciliation và warning state.
- Functions invocation tăng so với direct writes.

## Alternatives considered

### Direct Firestore writes cho mọi mutation

Loại vì lifecycle, capacity, quota và multi-document effects khó giữ nhất quán; SQLite outbox và Firestore offline queue cũng chồng trách nhiệm.

### Mọi read/write qua Functions

Loại vì mất realtime listener/offline cache advantages và tăng latency không cần thiết.

### Chờ mọi Member vô thời hạn

Loại vì một thiết bị mất hoặc user không quay lại có thể chặn bill vĩnh viễn.

### Fixed reconciliation timeout

Loại vì mọi timeout đều có thể ngắn hơn outage thực tế và tạo hành vi tùy ý.

### Finalize score ngay khi Host complete

Loại vì vi phạm mục tiêu offline reconciliation khi Member có pending events.

## Source

- PRD FR-02, FR-03, FR-04 và FR-05.
- Feature Spec Sections 2, 3, 4.2, 5 và 6.
- Approved finalization policy: Member sync plus explicit Host override.
