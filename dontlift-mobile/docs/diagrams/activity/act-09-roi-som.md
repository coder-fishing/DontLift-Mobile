# ACT-09 — Xin rời sớm

Nếu việc rời làm phiếu kết thúc đang mở trở thành nhất trí hợp lệ, giao dịch xử lý trạng thái phòng theo ADR-016.

```mermaid
flowchart TD
    A([Member ACTIVE]) --> B[Gửi yêu cầu rời sớm]
    B --> C[Host nhận yêu cầu qua listener]
    C --> D{Host chấp thuận?}
    D -->|Không| E[Ghi quyết định từ chối]
    E --> F[Member tiếp tục phiên]
    D -->|Có| G[Transaction ghi cutoff và EARLY_EXIT]
    G --> H[Giảm số thành viên đang hoạt động]
    H --> I[Member dừng tích lũy vi phạm sau cutoff]
    I --> J[Đồng bộ sự kiện đủ điều kiện trước cutoff]
    J --> K[Giữ thành viên trong kết quả và chia hóa đơn]
    F --> Z([Kết thúc yêu cầu])
    K --> Z
```

Nguồn đối chiếu: [decisions/ADR-015-spark-early-exit.md](../../decisions/ADR-015-spark-early-exit.md), [decisions/ADR-016-spark-termination-vote.md](../../decisions/ADR-016-spark-termination-vote.md).
