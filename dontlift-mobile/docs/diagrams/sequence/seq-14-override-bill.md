# SEQ-14 — Điều chỉnh phiên bản phần chia

Share ở bản cũ không được dùng để tạo QR hoặc xác nhận trả cho phiên bản mới.

```mermaid
sequenceDiagram
    actor H as Host
    participant A as Bill repository
    participant D as Firestore và Rules
    participant M as Member
    H->>A: Nhập FIXED_VND hoặc PERCENT_BPS
    A->>A: Thay raw shares được chọn, kiểm tra tổng và làm tròn
    A->>D: Kiểm tra billPaidCount bằng 0 và revision hiện tại
    A->>D: Stage bản override theo requestId
    A->>D: Publish revision và con trỏ override nguyên tử
    D-->>M: Listener đọc shares của revision đang công bố
    alt Khoản đã được đánh dấu trả hoặc revision thay đổi
        D-->>A: Reject, tải lại trạng thái
    end
```

Nguồn đối chiếu: [decisions/ADR-022-spark-bill-overrides.md](../../decisions/ADR-022-spark-bill-overrides.md), [api-contracts.md](../../api-contracts.md).
