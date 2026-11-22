# SEQ-15 — Xác nhận trả tiền thủ công

Không có callback ngân hàng tự động. Share bằng 0 hiển thị không cần thanh toán.

```mermaid
sequenceDiagram
    actor M as Member
    participant A as Mobile
    participant B as Ngân hàng
    actor H as Host
    participant D as Firestore và Rules
    M->>A: Mở phần tiền hiện tại còn nợ
    A->>D: Xác minh bill và settlement details còn hạn
    A-->>M: Hiển thị QR hoặc bank deep link
    M->>B: Thực hiện chuyển khoản ngoài DontLift
    H->>B: Đối chiếu tiền đã nhận
    H->>A: Xác nhận share đã trả
    A->>D: Transaction current share, receipt và billPaidCount
    alt Cùng request đã commit
        D-->>A: Replay, không tăng count lần nữa
    else Share dương hợp lệ chưa trả
        D-->>A: MARKED_AS_PAID và count tăng một
    end
    D-->>M: Listener trạng thái Host đã xác nhận
```

Nguồn đối chiếu: [decisions/ADR-023-spark-manual-payment-status.md](../../decisions/ADR-023-spark-manual-payment-status.md), [api-contracts.md](../../api-contracts.md).
