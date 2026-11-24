# STM-04 — Phiên Solo

Sơ đồ luồng runtime Solo; schema hỗ trợ CREATED nhưng không coi đó là bước bắt buộc của startOrResume hiện tại. Trạng thái đồng bộ được vẽ riêng.

```mermaid
stateDiagram-v2
    [*] --> ACTIVE: startOrResume hợp lệ, ghi SQLite
    ACTIVE --> ACTIVE: Resume cùng phiên đã lưu
    ACTIVE --> COMPLETED: Kết thúc và lưu summary với outbox
    ACTIVE --> CANCELLED: Hủy phiên qua controller
    COMPLETED --> [*]
    CANCELLED --> [*]
```

Nguồn đối chiếu: [product-requirements.md](../../product-requirements.md), [decisions/ADR-030-solo-direct-summary-sync.md](../../decisions/ADR-030-solo-direct-summary-sync.md).
