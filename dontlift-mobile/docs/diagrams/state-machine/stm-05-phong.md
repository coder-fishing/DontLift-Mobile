# STM-05 — Vòng đời phòng

Không có scheduler tự chuyển ABORTED trên Spark. Nếu mọi thiết bị offline, chuyển trạng thái chỉ xảy ra khi client đủ điều kiện kết nối lại.

```mermaid
stateDiagram-v2
    [*] --> WAITING: createRoom commit
    WAITING --> WAITING: Join, leave, transfer hoặc kick hợp lệ
    WAITING --> ACTIVE: Host startRoom
    WAITING --> CANCELLED: Host cuối cùng rời phòng chờ
    ACTIVE --> COMPLETED: Host completeRoom
    ACTIVE --> CANCELLED: Nhất trí ACTIVE trong 30 giây
    ACTIVE --> ABORTED: Client online xác nhận heartbeat quá 15 phút
    COMPLETED --> [*]
    CANCELLED --> [*]
    ABORTED --> [*]
```

Nguồn đối chiếu: [api-contracts.md](../../api-contracts.md), [decisions/ADR-019-spark-stale-room-abort.md](../../decisions/ADR-019-spark-stale-room-abort.md), [decisions/ADR-026-spark-lobby-leave-host-transfer.md](../../decisions/ADR-026-spark-lobby-leave-host-transfer.md).
