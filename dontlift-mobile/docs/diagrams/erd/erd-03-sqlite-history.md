# ERD-03 — SQLite: phòng và lịch sử

Chỉ rooms → room_members được vẽ như FK khai báo. History là projection theo owner; không buộc tồn tại một room cache cục bộ tương ứng. APP_SETTINGS độc lập.

```mermaid
erDiagram
    ROOMS ||--o{ ROOM_MEMBERS : declared_foreign_key
    LOCAL_PROFILES ||..o{ SOLO_HISTORY_CACHE : owner_logical
    LOCAL_PROFILES ||..o{ GROUP_HISTORY : owner_logical
    LOCAL_PROFILES ||..o{ GROUP_ROOM_HISTORY_CACHE : owner_logical
    ROOMS {
        TEXT room_id PK
        TEXT host_uid
        TEXT pin
        TEXT status
        TEXT created_at
        TEXT updated_at
        TEXT reconciliation_status
        INTEGER pending_member_count
        TEXT finalization_reason
    }
    ROOM_MEMBERS {
        TEXT room_id PK,FK
        TEXT uid PK
        TEXT display_name
        TEXT role
        TEXT status
        TEXT joined_at
        TEXT sync_acknowledged_at
    }
    SOLO_HISTORY_CACHE {
        TEXT user_id PK
        TEXT session_id PK
        INTEGER duration_seconds
        INTEGER lift_count
        INTEGER violation_duration_seconds
        INTEGER penalty_score
        TEXT started_at
        TEXT completed_at
    }
    GROUP_HISTORY {
        TEXT actor_uid PK
        TEXT room_id PK
        INTEGER completed_at_utc_ms
        TEXT summary_json
        TEXT detail_json
        TEXT sync_status
        TEXT source
        INTEGER terminal_confirmed
    }
    GROUP_ROOM_HISTORY_CACHE {
        TEXT actor_uid PK
        TEXT room_id PK
        INTEGER completed_at_utc_ms
        TEXT summary_json
        TEXT detail_json
    }
    APP_SETTINGS {
        TEXT key PK
        TEXT value
    }
```

Nguồn đối chiếu: [architecture.md](../../architecture.md), [decisions/ADR-024-spark-group-history.md](../../decisions/ADR-024-spark-group-history.md), [decisions/ADR-028-shared-group-history-index.md](../../decisions/ADR-028-shared-group-history-index.md).
