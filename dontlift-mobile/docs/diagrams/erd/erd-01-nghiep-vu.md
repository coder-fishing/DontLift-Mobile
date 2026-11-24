# ERD-01 — Thực thể nghiệp vụ

Mô hình logic phục vụ báo cáo. BILL_VERSION và PAYMENT_CONFIRMATION là khái niệm nghiệp vụ; cách lưu vật lý là manifest, shares và command receipts, không mặc định có bảng SQL cùng tên.

```mermaid
erDiagram
    USER ||--o{ SOLO_SESSION : owns
    USER ||--o{ MEMBERSHIP : participates
    ROOM ||--|{ MEMBERSHIP : contains
    ROOM ||--o{ GROUP_VIOLATION : records
    MEMBERSHIP ||--o{ GROUP_VIOLATION : generates
    SOLO_SESSION ||--o{ SOLO_VIOLATION : records
    ROOM ||--o{ BILL_VERSION : publishes
    BILL_VERSION ||--|{ BILL_SHARE : contains
    MEMBERSHIP ||--o{ BILL_SHARE : receives
    BILL_SHARE ||--o| PAYMENT_CONFIRMATION : confirmed_by_host
    USER ||--o{ PREMIUM_ORDER : purchases
    USER {
        string uid PK
        timestamp premiumExpiresAt
    }
    ROOM {
        string roomId PK
        string hostId FK
        string status
        string reconciliationStatus
    }
    MEMBERSHIP {
        string roomId PK
        string uid PK
        string role
        int penaltyScore
    }
    BILL_SHARE {
        string roomId PK
        string version PK
        string uid PK
        int shareVnd
    }
```

Nguồn đối chiếu: [feature-specification.md](../../feature-specification.md), [api-contracts.md](../../api-contracts.md).
