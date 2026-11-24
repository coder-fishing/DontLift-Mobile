# SEQ-16 — payOS và cấp quyền có thời hạn

Đơn khác nhau cộng nối thời hạn từ max(now, expiry cũ); webhook lặp không cộng lặp.

```mermaid
sequenceDiagram
    actor U as Người dùng
    participant A as Mobile
    participant E as Express API
    participant P as payOS
    participant D as Firestore qua Admin
    U->>A: Chọn packageId
    A->>E: Tạo order với requestId và Firebase token
    E->>D: Reserve orderCode, giá lấy từ server
    E->>P: Tạo hoặc phục hồi payment link
    P-->>E: Checkout URL
    E-->>A: Thông tin order
    A-->>U: Mở checkout
    U->>P: Thanh toán
    P->>E: Webhook
    E->>E: Xác minh chữ ký
    E->>P: Đọc payment link bằng API đã xác thực
    P-->>E: Order, amount, link ID và trạng thái
    E->>D: Transaction receipt và gia hạn một lần
    A->>E: Kiểm tra trạng thái order
    E-->>A: Trạng thái và expiry được xác nhận
    Note over A,D: Redirect không cấp quyền, expiry chỉ server được ghi
```

Nguồn đối chiếu: [decisions/ADR-025-payos-expiring-premium.md](../../decisions/ADR-025-payos-expiring-premium.md), [api-contracts.md](../../api-contracts.md).
