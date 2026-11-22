# STM-06 — Đối soát và chốt điểm

ALL_SYNCED và HOST_OVERRIDE là finalizationReason; FINALIZED là reconciliationStatus. Điểm đã chốt không được sửa bởi sự kiện muộn.

```mermaid
stateDiagram-v2
    state "PENDING" as Pending
    state "FINALIZED / ALL_SYNCED" as AllSynced
    state "FINALIZED / HOST_OVERRIDE" as Override
    [*] --> Pending: completeRoom
    Pending --> Pending: ACK hợp lệ, vẫn còn pending
    Pending --> AllSynced: ACK cuối cùng
    Pending --> Override: Host xác nhận cảnh báo và ghi audit
    AllSynced --> [*]
    Override --> [*]
```

Nguồn đối chiếu: [decisions/ADR-017-spark-room-completion.md](../../decisions/ADR-017-spark-room-completion.md), [decisions/ADR-018-spark-host-finalization-override.md](../../decisions/ADR-018-spark-host-finalization-override.md).
