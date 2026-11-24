# ERD-04 — Firestore: phòng và thành viên

ERD thích nghi cho NoSQL: PK là document ID trong collection cha, không phải khóa SQL toàn cục. Nét liền là chứa subcollection; nét đứt là tham chiếu logic. Không dùng participantIds làm nguồn membership.

```mermaid
erDiagram
    USERS ||..o{ ROOMS : hostId_reference
    ROOMS ||--o{ MEMBERS : subcollection
    USERS ||..o{ MEMBERS : uid_reference
    ROOMS ||--o{ VIOLATIONS : subcollection
    MEMBERS ||..o{ VIOLATIONS : userId_reference
    ROOMS ||--o{ EARLY_EXIT_REQUESTS : subcollection
    ROOMS ||--o{ TERMINATION_VOTES : subcollection
    ROOMS ||--o{ RECONCILIATION_AUDITS : subcollection
    USERS {
        string uid PK
        string displayName
        timestamp premiumExpiresAt
    }
    ROOMS {
        string roomId PK
        string hostId
        string pin
        string status
        int participantCount
        int activeMemberCount
        string reconciliationStatus
        int pendingMemberCount
        string finalizationReason
    }
    MEMBERS {
        string uid PK
        string role
        string status
        int liftCount
        int violationDurationSeconds
        int penaltyScore
    }
    VIOLATIONS {
        string eventId PK
        string userId
        timestamp startedAt
        timestamp endedAt
        int durationSeconds
        boolean excludedFromFinalScore
    }
```

Nguồn đối chiếu: [api-contracts.md](../../api-contracts.md), [architecture.md](../../architecture.md).
