# ACT-08 — Theo dõi phiên nhóm

Điểm chia sẻ lấy từ Firestore; sự kiện đến muộn phải tuân thủ thời gian kết thúc/rời sớm và trạng thái chốt điểm.

```mermaid
flowchart TD
    A([Host bắt đầu từ WAITING]) --> B[Transaction chuyển ACTIVE]
    B --> C[Clients nhận snapshot đã commit]
    C --> D[Mỗi thiết bị theo dõi vi phạm độc lập]
    D --> E[Lưu sự kiện vào SQLite]
    E --> F{Có mạng?}
    F -->|Không| G[Giữ sự kiện cục bộ]
    F -->|Có| H[Transaction đồng bộ theo eventId và cutoff]
    H --> I[Listener cập nhật bảng điểm]
    G --> J{Phiên còn ACTIVE?}
    I --> J
    J -->|Có| D
    J -->|Không| K[Chốt dữ liệu theo cutoff chính thức]
    K --> Z([Đi vào luồng tổng kết phù hợp])
```

Nguồn đối chiếu: [decisions/ADR-013-spark-room-start.md](../../decisions/ADR-013-spark-room-start.md), [decisions/ADR-014-spark-group-violations.md](../../decisions/ADR-014-spark-group-violations.md), [decisions/ADR-015-spark-early-exit.md](../../decisions/ADR-015-spark-early-exit.md).
