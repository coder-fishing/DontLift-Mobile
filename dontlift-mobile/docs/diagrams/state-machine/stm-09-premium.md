# STM-09 — Quyền Premium theo thời gian

Trạng thái quyền được suy ra từ premiumExpiresAt; không cần scheduler đổi boolean khi hết hạn. Không dùng kích hoạt checksum offline cũ.

```mermaid
stateDiagram-v2
    state "Không có Premium còn hạn" as Free
    state "Premium còn hạn" as Premium
    [*] --> Free
    Free --> Premium: Server xác minh đơn PAID và commit expiry tương lai
    Premium --> Premium: Đơn PAID khác cộng nối thời hạn
    Premium --> Free: Thời gian hiện tại đạt premiumExpiresAt
    Free --> Free: Redirect hoặc webhook trùng không cấp thêm quyền
```

Nguồn đối chiếu: [decisions/ADR-025-payos-expiring-premium.md](../../decisions/ADR-025-payos-expiring-premium.md), [api-contracts.md](../../api-contracts.md).
