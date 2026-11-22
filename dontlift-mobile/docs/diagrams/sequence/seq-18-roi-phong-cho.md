# SEQ-18 — Chuyển Host khi rời phòng chờ

Rules kiểm tra recipient đủ điều kiện và writes liên kết, không chứng minh thứ tự lựa chọn.

```mermaid
sequenceDiagram
    actor H as Host hiện tại
    participant A as Lobby repository
    participant D as Firestore và Rules
    participant M as Các thành viên
    H->>A: Xác nhận rời phòng WAITING
    A->>D: Đọc roster từ server
    A->>A: Chọn thành viên joinedAt sớm nhất, tie UID
    alt Có người nhận quyền
        A->>D: Transaction đọc lại count và recipient
        A->>D: Xóa Host cũ, đổi hostId, promote recipient, giảm count
    else Host là người cuối cùng
        A->>D: Transaction xóa membership và CANCELLED
    end
    D-->>A: Commit hoặc retry do thay đổi đồng thời
    D-->>M: Listener hostId, vai trò và count mới
    A-->>H: Dọn cache sau server success
```

Nguồn đối chiếu: [decisions/ADR-026-spark-lobby-leave-host-transfer.md](../../decisions/ADR-026-spark-lobby-leave-host-transfer.md).
