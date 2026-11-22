# ACT-10 — Biểu quyết hủy phiên

Hết hạn được kiểm tra theo thời gian server; không cần scheduler xóa phiếu.

```mermaid
flowchart TD
    A([Thành viên ACTIVE đề xuất]) --> B[Tạo phiếu và mốc thời gian server]
    B --> C[Thu thập phiếu của thành viên ACTIVE]
    C --> D{Đủ 100 phần trăm đồng ý trước hạn?}
    D -->|Có| E[Transaction chuyển CANCELLED]
    E --> F[Dừng phiên, lưu lịch sử phù hợp]
    F --> G[Không chia hóa đơn theo điểm]
    D -->|Chưa| H{Đã hết 30 giây?}
    H -->|Chưa| C
    H -->|Rồi| I[Phiếu không còn hiệu lực]
    I --> J[Phiên tiếp tục ACTIVE]
    G --> Z([Kết thúc])
    J --> Z
```

Nguồn đối chiếu: [decisions/ADR-016-spark-termination-vote.md](../../decisions/ADR-016-spark-termination-vote.md).
