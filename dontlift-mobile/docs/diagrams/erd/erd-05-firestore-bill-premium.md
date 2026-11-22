# ERD-05 — Firestore: hóa đơn, lịch sử và Premium

Các nhãn PERSONAL_SESSIONS và ROOM_HISTORY_INDEX đại diện đường dẫn cá nhân, không phải collection gốc. Chi tiết path/field theo api-contracts; chỉ trích các trường chính. Premium orders do backend quản lý; ảnh Cloudinary không nằm trong Firestore.

```mermaid
erDiagram
    USERS ||--o{ PERSONAL_SESSIONS : users_uid_sessions
    USERS ||--o{ ROOM_HISTORY_INDEX : owner_room_index
    ROOMS ||--o{ BILL_SHARES : default_shares
    ROOMS ||--o{ BILL_OVERRIDES : versioned_manifests
    BILL_OVERRIDES ||--o{ OVERRIDE_SHARES : subcollection
    ROOMS ||--o{ BILL_COMMANDS : publication_receipts
    ROOMS ||--o{ BILL_OVERRIDE_COMMANDS : override_receipts
    ROOMS ||--o| SETTLEMENT_DETAILS : current_document
    USERS ||..o{ PREMIUM_ORDERS : owner_reference
    ROOMS {
        string roomId PK
        int billRevision
        string billOverrideRequestId
        int billPaidCount
    }
    BILL_SHARES {
        string uid PK
        int shareVnd
        string paymentStatus
    }
    OVERRIDE_SHARES {
        string uid PK
        int shareVnd
        string paymentStatus
    }
    SETTLEMENT_DETAILS {
        string id PK
        string bankId
        string accountNumber
        timestamp expiresAt
    }
    PREMIUM_ORDERS {
        string orderId PK
        string ownerUid
        int amountVnd
        string status
    }
```

Nguồn đối chiếu: [api-contracts.md](../../api-contracts.md), [decisions/ADR-025-payos-expiring-premium.md](../../decisions/ADR-025-payos-expiring-premium.md), [decisions/ADR-030-solo-direct-summary-sync.md](../../decisions/ADR-030-solo-direct-summary-sync.md).
