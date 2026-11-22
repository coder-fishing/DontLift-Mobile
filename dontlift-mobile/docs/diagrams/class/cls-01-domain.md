# CLS-01 — Mô hình miền tổng quan

Mô hình khái niệm, không khẳng định các entity đều là class có constructor. Violation thuộc ngữ cảnh Solo hoặc nhóm; không bắt buộc thuộc cả hai.

```mermaid
classDiagram
    class User {
        +string uid
        +string displayName
        +Date premiumExpiresAt
    }
    class SoloSession {
        +string id
        +string userId
        +SoloSessionMode mode
        +number durationSeconds
        +string startedAt
    }
    class Room {
        +string id
        +string hostId
        +string status
        +string reconciliationStatus
    }
    class RoomMember {
        +string uid
        +string role
        +string status
        +number penaltyScore
    }
    class Violation {
        +string eventId
        +string userId
        +number durationSeconds
    }
    class BillShare {
        +string uid
        +number shareVnd
    }
    User "1" --> "0..*" SoloSession : sở hữu
    User "1" --> "0..*" RoomMember : tham gia qua
    Room "1" *-- "1..*" RoomMember : roster theo phiên
    Room "1" --> "0..*" Violation : có sự kiện nhóm
    SoloSession "1" --> "0..*" Violation : có sự kiện cá nhân
    RoomMember "1" --> "0..*" BillShare : theo phiên bản bill
```

Nguồn đối chiếu: [feature-specification.md](../../feature-specification.md), [api-contracts.md](../../api-contracts.md).
