# SEQ-06 — Tham gia và bắt đầu nhóm

Membership là subcollection members theo UID. Retry cùng request không tạo thêm thành viên.

```mermaid
sequenceDiagram
    actor M as Member
    actor H as Host
    participant A as Clients
    participant D as Firestore và Rules
    M->>A: Nhập PIN hoặc quét QR
    A->>D: Transaction resolve lời mời và kiểm tra WAITING
    A->>D: Tạo member, tăng count, ghi receipt
    D-->>A: Commit hoặc từ chối capacity
    D-->>H: Listener cập nhật roster
    H->>A: Bắt đầu phiên
    A->>D: Transaction startRoom
    D-->>A: ACTIVE và thời gian server
    A-->>M: Khởi tạo theo dõi trên thiết bị
    A-->>H: Khởi tạo theo dõi trên thiết bị
```

Nguồn đối chiếu: [decisions/ADR-012-spark-room-join.md](../../decisions/ADR-012-spark-room-join.md), [decisions/ADR-013-spark-room-start.md](../../decisions/ADR-013-spark-room-start.md).
