# SEQ-17 — Khôi phục lịch sử trên thiết bị

Thông tin chuyển khoản cần đọc mới trước khi mở VietQR; không khôi phục QR từ lịch sử cục bộ.

```mermaid
sequenceDiagram
    actor U as Người dùng
    participant A as History repository
    participant L as SQLite
    participant D as Firestore và Rules
    U->>A: Mở History
    A->>L: Đọc lịch sử owner, phân trang
    L-->>A: Local summary và cache
    A-->>U: Hiển thị ngay dữ liệu đang có
    opt Có kết nối
        A->>D: Đọc personal summaries và owner room index
        D-->>A: Chỉ các bản ghi có quyền
        A->>L: Cập nhật cache, giữ pending hoặc failed
        A-->>U: Cập nhật danh sách
    end
    U->>A: Mở chi tiết nhóm
    A->>D: Đọc room, membership và bill theo quyền hiện tại
    A-->>U: Phân biệt local stats và canonical score
```

Nguồn đối chiếu: [decisions/ADR-030-solo-direct-summary-sync.md](../../decisions/ADR-030-solo-direct-summary-sync.md), [decisions/ADR-024-spark-group-history.md](../../decisions/ADR-024-spark-group-history.md), [decisions/ADR-028-shared-group-history-index.md](../../decisions/ADR-028-shared-group-history-index.md).
