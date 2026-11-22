# SEQ-05 — Tạo phòng trên Spark

Không gọi createRoom Cloud Function trong luồng Spark hiện tại.

```mermaid
sequenceDiagram
    actor H as Host
    participant A as Room repository
    participant D as Firestore transaction và Rules
    H->>A: Tạo phòng với requestId
    A->>D: Đọc receipt, quota, PIN reservation
    alt Request đã commit cùng payload
        D-->>A: Trả lại phòng cũ
    else PIN bị trùng
        D-->>A: Thử PIN khác trong giới hạn
    else Đủ quota và quyền
        A->>D: Tạo room WAITING, HOST member, PIN, receipt và usage
        D-->>A: Commit nguyên tử
    else Hết quota hoặc thiếu quyền
        D-->>A: Từ chối
    end
    A-->>H: PIN, QR hoặc lỗi rõ ràng
```

Nguồn đối chiếu: [decisions/ADR-011-spark-room-creation.md](../../decisions/ADR-011-spark-room-creation.md), [api-contracts.md](../../api-contracts.md).
