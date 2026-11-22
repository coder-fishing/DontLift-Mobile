# ACT-03 — Phiên tập trung cá nhân

Countdown hiện kiểm tra 5–720 phút, theo bước 5 phút; Solo có thể hoàn tất khi không có mạng.

```mermaid
flowchart TD
    A([Bắt đầu]) --> B[Chọn Countdown hoặc Stopwatch]
    B --> C{Cảm biến sẵn sàng và cấu hình hợp lệ?}
    C -->|Không| D[Thông báo và chờ điều chỉnh]
    D --> B
    C -->|Có| E[SQLite startOrResume theo người dùng]
    E --> F[Đặt điện thoại úp xuống]
    F --> G[Theo dõi cảm biến và lifecycle]
    G --> H{Đến hạn hoặc người dùng kết thúc?}
    H -->|Chưa| G
    H -->|Có| I[Chốt thời lượng và vi phạm]
    I --> J[Transaction lưu tổng kết và outbox]
    J --> K[Hiển thị kết quả cục bộ]
    K --> L{Có mạng?}
    L -->|Có| M[Đồng bộ lịch sử theo ADR-030]
    L -->|Không| N[Giữ outbox chờ gửi]
    M --> Z([Kết thúc])
    N --> Z
```

Nguồn đối chiếu: [product-requirements.md](../../product-requirements.md), [decisions/ADR-030-solo-direct-summary-sync.md](../../decisions/ADR-030-solo-direct-summary-sync.md).
