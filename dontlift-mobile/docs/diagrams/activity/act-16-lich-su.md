# ACT-16 — Tra cứu lịch sử

Không lưu thông tin ngân hàng hay QR trong lịch sử. Chỉ mục shared room hỗ trợ thành viên tìm lại phiên; tổng kết cục bộ không thay thế điểm nhóm.

```mermaid
flowchart TD
    A([Mở lịch sử theo UID]) --> B[Đọc dữ liệu SQLite và cache]
    B --> C[Hiển thị danh sách phân trang]
    C --> D{Có mạng?}
    D -->|Có| E[Đọc lịch sử cá nhân và chỉ mục nhóm có quyền]
    E --> F[Hợp nhất tại repository, giữ dữ liệu pending]
    D -->|Không| G[Hiển thị dữ liệu cục bộ và trạng thái offline]
    F --> H[Chọn chi tiết phiên]
    G --> H
    H --> I[Phân biệt thống kê thiết bị và điểm nhóm đã chốt]
    I --> J{Mở thanh toán còn nợ?}
    J -->|Có| K[Xác minh lại membership, bill hiện tại và expiry]
    K --> L[Chỉ mở VietQR nếu đủ điều kiện]
    J -->|Không| Z([Kết thúc tra cứu])
    L --> Z
```

Nguồn đối chiếu: [decisions/ADR-030-solo-direct-summary-sync.md](../../decisions/ADR-030-solo-direct-summary-sync.md), [decisions/ADR-024-spark-group-history.md](../../decisions/ADR-024-spark-group-history.md), [decisions/ADR-028-shared-group-history-index.md](../../decisions/ADR-028-shared-group-history-index.md).
