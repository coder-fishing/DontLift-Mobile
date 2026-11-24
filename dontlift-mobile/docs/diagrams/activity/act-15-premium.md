# ACT-15 — Mua và cấp quyền Premium

Redirect chỉ phục vụ điều hướng. Webhook gửi lặp không được gia hạn lặp; mua không tự gia hạn định kỳ.

```mermaid
flowchart TD
    A([Chọn gói]) --> B[Express xác minh Firebase ID token]
    B --> C[Tạo hoặc phục hồi đơn theo requestId]
    C --> D[payOS cung cấp checkout]
    D --> E[Người dùng thanh toán]
    E --> F{Nhận webhook hợp lệ?}
    F -->|Chưa| G[Giữ trạng thái đang chờ, cho kiểm tra lại]
    F -->|Có| H[Kiểm chữ ký và đọc giao dịch qua API payOS]
    H --> I{Đúng đơn, số tiền và trạng thái PAID?}
    I -->|Không| J[Không cấp quyền]
    I -->|Có| K[Transaction receipt và cộng thời hạn một lần]
    K --> L[Ứng dụng đọc premiumExpiresAt mới]
    L --> Z([Cập nhật quyền sử dụng])
    G --> Z
    J --> Z
```

Nguồn đối chiếu: [decisions/ADR-025-payos-expiring-premium.md](../../decisions/ADR-025-payos-expiring-premium.md), [api-contracts.md](../../api-contracts.md).
