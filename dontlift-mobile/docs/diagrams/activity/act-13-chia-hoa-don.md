# ACT-13 — Tính, điều chỉnh và công bố hóa đơn

Sơ đồ khái quát pipeline toán học dùng chung. Công bố mặc định và override có hợp đồng ghi phiên bản riêng; override bị khóa khi billPaidCount lớn hơn 0.

```mermaid
flowchart TD
    A([COMPLETED và FINALIZED]) --> B[Host nhập tổng tiền và thông tin nhận]
    B --> C[Đọc điểm đóng băng của danh sách thành viên]
    C --> D{Tổng điểm bằng 0?}
    D -->|Có| E[Chia đều số tiền gốc]
    D -->|Không| F[40 phần trăm chia đều, 60 theo tỷ lệ điểm]
    E --> G[Tạo vector phần tiền chưa làm tròn]
    F --> G
    G --> H{Có override?}
    H -->|Có| I[Thay phần được chọn, giữ phần còn lại]
    I --> J{Tổng vector bằng hóa đơn?}
    J -->|Không| K[Yêu cầu sửa điều chỉnh]
    K --> I
    J -->|Có| L[Làm tròn và phân phối chênh lệch]
    H -->|Không| L
    L --> M[Kiểm tra không âm và tổng tiền chính xác]
    M --> N[Chuẩn bị manifest và stage từng nhóm share]
    N --> O[Transaction công bố con trỏ và receipt]
    O --> P[Thành viên xem kết quả đã công bố]
    P --> Z([Kết thúc])
```

Nguồn đối chiếu: [decisions/ADR-021-spark-default-bill.md](../../decisions/ADR-021-spark-default-bill.md), [decisions/ADR-022-spark-bill-overrides.md](../../decisions/ADR-022-spark-bill-overrides.md).
