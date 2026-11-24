# ACT-11 — Hoàn tất và chốt điểm

ACK là lời xác nhận từ client. Danh sách chưa ACK trong audit là quan sát của Host, không phải roster đã được server xác minh đầy đủ.

```mermaid
flowchart TD
    A([Host xác nhận hoàn tất]) --> B[Transaction COMPLETED và PENDING]
    B --> C[Mỗi thành viên gửi sự kiện đủ điều kiện]
    C --> D[Kiểm tra outbox rồi ACK]
    D --> E{Còn thành viên chưa ACK?}
    E -->|Không| F[FINALIZED với ALL_SYNCED]
    E -->|Có| G{Host chọn chốt thiếu dữ liệu?}
    G -->|Không| H[Tiếp tục chờ kết nối và ACK]
    H --> C
    G -->|Có| I[Xác nhận cảnh báo dữ liệu đến muộn]
    I --> J[Transaction FINALIZED với HOST_OVERRIDE và audit]
    J --> K[Sự kiện muộn hợp lệ chỉ lưu lịch sử]
    F --> L[Cho phép tính hóa đơn]
    K --> L
    L --> Z([Điểm đã đóng băng])
```

Nguồn đối chiếu: [decisions/ADR-017-spark-room-completion.md](../../decisions/ADR-017-spark-room-completion.md), [decisions/ADR-018-spark-host-finalization-override.md](../../decisions/ADR-018-spark-host-finalization-override.md).
