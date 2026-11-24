# SEQ-10 — Hoàn tất, ACK và Host override

Không có timeout tự chốt ALL_SYNCED. Rules không đọc SQLite và không chứng minh danh sách pending của Host đầy đủ.

```mermaid
sequenceDiagram
    actor H as Host
    participant D as Firestore và Rules
    participant M as Mỗi thành viên
    participant L as SQLite của thành viên
    H->>D: completeRoom transaction
    D-->>M: COMPLETED, reconciliation PENDING, endedAt
    M->>L: Kiểm tra và gửi outbox đến cutoff
    M->>D: ACK sau kiểm tra cục bộ
    D->>D: Giảm pendingMemberCount nguyên tử
    alt ACK cuối cùng
        D->>D: FINALIZED với ALL_SYNCED
    else Host chọn override khi vẫn còn pending
        H->>H: Xác nhận cảnh báo và snapshot pending UIDs
        H->>D: Transaction chốt điểm và create-only audit
        D->>D: FINALIZED với HOST_OVERRIDE
        Note over D,M: Event muộn hợp lệ chỉ lưu lịch sử, không sửa điểm
    end
    D-->>H: Cho phép tính bill từ điểm đóng băng
```

Nguồn đối chiếu: [decisions/ADR-017-spark-room-completion.md](../../decisions/ADR-017-spark-room-completion.md), [decisions/ADR-018-spark-host-finalization-override.md](../../decisions/ADR-018-spark-host-finalization-override.md).
