# ACT-06 — Tạo và tham gia phòng

PIN mới 8 chữ số; lời mời 4 chữ số cũ được chấp nhận trong chuyển tiếp. Tạo/join không xếp hàng để phát lại khi offline.

```mermaid
flowchart TD
    A([Đã đăng nhập, có mạng]) --> B{Tạo hay tham gia?}
    B -->|Tạo| C[Host gửi yêu cầu tạo với requestId]
    C --> D{Quota và dữ liệu hợp lệ?}
    D -->|Không| E[Thông báo giới hạn hoặc lỗi]
    D -->|Có| F[Transaction giữ PIN và tạo phòng, membership]
    F --> G[Hiển thị PIN 8 chữ số và QR]
    B -->|Tham gia| H[Nhập PIN hoặc quét QR]
    H --> I[Phân tích lời mời]
    I --> J{WAITING và còn chỗ?}
    J -->|Không| E
    J -->|Có| K[Transaction tạo membership và cập nhật count]
    K --> L[Đăng ký listeners phòng chờ]
    G --> L
    L --> Z([Phòng chờ])
    E --> X([Kết thúc yêu cầu])
```

Nguồn đối chiếu: [api-contracts.md](../../api-contracts.md), [decisions/ADR-011-spark-room-creation.md](../../decisions/ADR-011-spark-room-creation.md), [decisions/ADR-012-spark-room-join.md](../../decisions/ADR-012-spark-room-join.md).
