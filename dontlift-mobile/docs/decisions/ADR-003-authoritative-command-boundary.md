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
- `syncEvents` là canonical ingestion path; client không direct `setDoc` violation hoặc Solo summary.

**Ngoại lệ có giới hạn:** `createRoom` dùng Firestore client transaction được Security Rules authorize theo [ADR-011](ADR-011-spark-room-creation.md); `joinRoomByPin` theo [ADR-012](ADR-012-spark-room-join.md); `startRoom` theo [ADR-013](ADR-013-spark-room-start.md); early-exit request/decision theo [ADR-015](ADR-015-spark-early-exit.md); và room completion/sync acknowledgment theo [ADR-017](ADR-017-spark-room-completion.md). Mỗi exception chỉ cho phép exact transaction được nêu trong ADR riêng; không mở direct writes cho lifecycle, membership, score, quota khác, vote hoặc bill commands ngoài các contract đó.

ADR-014 bổ sung ngoại lệ hẹp cho một confirmed group violation: client transaction được Rules kiểm tra chỉ có thể ghi event bất biến của chính member và tăng đúng các bộ đếm/điểm của member đó trong cùng room. Các outbox event khác vẫn đi qua `syncEvents`; client không được ghi điểm của người khác hoặc aggregate tùy ý.

Quyết định này là human-approved override của Feature Spec Section 6.3. Override giữ UUID idempotency nhưng chuyển schema, ownership, lifecycle validation và aggregate update vào một Cloud Function transaction.

`completeRoom` thực hiện `ACTIVE → COMPLETED` nhưng mở `reconciliationStatus = PENDING`. Theo ADR-017, transaction Spark của Host đóng room và khởi tạo pending count từ roster cố định. Mỗi member flush eligible events đến room `endedAt`, rồi gửi sync acknowledgment trong transaction liên kết với pending count. Rules khóa event mới sau acknowledgment và khóa toàn bộ score khi count về 0 (`ALL_SYNCED`). Vì Rules không thể đọc SQLite, client acknowledgment là attestation sau kiểm tra outbox cục bộ; không được mô tả như server đã xác minh thiết bị không còn event.

Final score được khóa khi:

1. Mọi relevant Member đã acknowledgment: `ALL_SYNCED`; hoặc
2. (Ngoài SL-020) Host xác nhận override theo contract riêng sau khi thấy đúng warning: **“Some Members have not synced. Late violations will not affect payment.”**

`HOST_OVERRIDE` atomically finalizes score và ghi append-only `rooms/{roomId}/reconciliationAudits/{auditId}` với Host UID, `requestId`, unsynced Member UIDs, room end time, created time và resulting score snapshot reference. Bill calculation bị chặn đến khi reconciliation `FINALIZED`. Late event hợp lệ sau Host override vẫn được lưu vào history với `excludedFromFinalScore = true` và `exclusionReason = HOST_OVERRIDE`; score snapshot và bill đã khóa không đổi.

Termination vote dùng authoritative `expiresAt`. Ballot sau expiry bị từ chối ngay cả khi physical cleanup chưa chạy. SL-020 không triển khai Host override hoặc timeout; một member không quay lại có thể giữ room ở `PENDING`.

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
- Human decision F-02 ngày 2026-09-23: `syncEvents` thay direct Firestore write trong Feature Spec Section 6.3.
- Approved finalization policy F-04 ngày 2026-09-23: Member sync plus explicit Host override.
