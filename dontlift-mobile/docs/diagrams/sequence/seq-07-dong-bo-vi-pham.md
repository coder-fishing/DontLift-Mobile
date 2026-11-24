# SEQ-07 — Đồng bộ vi phạm nhóm

Rules kiểm tra giao dịch và dữ liệu, không chứng minh cảm biến thực sự quan sát được sự kiện.

```mermaid
sequenceDiagram
    participant C as Detection controller
    participant L as SQLite và outbox
    participant W as Group sync worker
    participant D as Firestore và Rules
    participant V as Clients trong phòng
    C->>L: Ghi sự kiện với eventId ổn định
    W->>L: Claim sự kiện đủ điều kiện
    W->>D: Transaction đọc room, member và event đích
    alt Event đã tồn tại cùng nội dung
        D-->>W: Kết quả cũ, không cộng lặp
    else Còn hợp lệ để cập nhật điểm
        W->>D: Ghi event và cập nhật aggregate nguyên tử
        D-->>V: Listener nhận điểm mới
    else Sau HOST_OVERRIDE nhưng event hợp lệ trước cutoff
        W->>D: Ghi history-only, excludedFromFinalScore
    else Ngoài cutoff hoặc không đủ quyền
        D-->>W: Từ chối theo hợp đồng
    end
    W->>L: ACK hoặc ghi trạng thái lỗi
```

Nguồn đối chiếu: [decisions/ADR-014-spark-group-violations.md](../../decisions/ADR-014-spark-group-violations.md), [decisions/ADR-015-spark-early-exit.md](../../decisions/ADR-015-spark-early-exit.md), [decisions/ADR-018-spark-host-finalization-override.md](../../decisions/ADR-018-spark-host-finalization-override.md).
