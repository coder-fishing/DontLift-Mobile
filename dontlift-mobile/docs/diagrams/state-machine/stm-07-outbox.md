# STM-07 — Trạng thái hàng đợi đồng bộ

Lease không tạo trạng thái SENDING mới. Không retry vô hạn lỗi schema/quyền; retry thủ công tuân thủ hợp đồng từng loại sự kiện.

```mermaid
stateDiagram-v2
    [*] --> PENDING: Commit dữ liệu và outbox
    PENDING --> PENDING: Claim lease hoặc lỗi tạm thời và backoff
    PENDING --> PENDING: Lease hết hạn, worker claim lại
    PENDING --> SYNCED: Server xác nhận hoặc replay trùng hợp lệ
    PENDING --> FAILED: Lỗi vĩnh viễn hoặc xung đột nội dung
    FAILED --> PENDING: Retry có kiểm tra theo owner và sự kiện
    SYNCED --> [*]
```

Nguồn đối chiếu: [architecture.md](../../architecture.md), [decisions/ADR-030-solo-direct-summary-sync.md](../../decisions/ADR-030-solo-direct-summary-sync.md).
