# ERD-02 — SQLite: phiên và đồng bộ

Đối chiếu migrations.ts; chỉ liệt kê các cột chính để dễ đọc. Nét đứt là liên kết logic theo ID, không khẳng định có FOREIGN KEY. Một phiên GROUP có ngữ cảnh phòng; outbox có thể không gắn session_id.

```mermaid
erDiagram
    LOCAL_PROFILES ||..o{ SESSIONS : user_id_logical
    SESSIONS ||..o{ VIOLATION_LOGS : session_id_logical
    SESSIONS ||..o{ LIFECYCLE_CANDIDATES : session_id_logical
    SESSIONS o|..o{ SYNC_OUTBOX : optional_session_id
    LOCAL_PROFILES {
        TEXT uid PK
        TEXT email
        TEXT display_name
        INTEGER created_at_utc_ms
        INTEGER premium_expires_at_utc_ms
        TEXT avatar_uri
        TEXT avatar_public_id
    }
    SESSIONS {
        TEXT id PK
        TEXT user_id
        TEXT mode
        TEXT status
        INTEGER duration_seconds
        TEXT started_at
        TEXT completed_at
        TEXT synced_at
    }
    VIOLATION_LOGS {
        TEXT event_id PK
        TEXT session_id
        TEXT room_id
        TEXT user_id
        TEXT started_at
        TEXT confirmed_at
        TEXT ended_at
        INTEGER duration_seconds
        TEXT sync_status
    }
    LIFECYCLE_CANDIDATES {
        TEXT id PK
        TEXT session_id
        TEXT user_id
        INTEGER transition_at_utc_ms
        INTEGER transition_at_monotonic_ms
        TEXT process_instance_id
        TEXT state
        INTEGER resolved_at_utc_ms
    }
    SYNC_OUTBOX {
        TEXT event_id PK
        TEXT actor_uid
        TEXT event_type
        TEXT aggregate_type
        TEXT aggregate_id
        TEXT session_id
        TEXT payload_json
        TEXT sync_status
        INTEGER attempt_count
        INTEGER next_attempt_at
        INTEGER lease_expires_at
        TEXT last_error_code
    }
```

Nguồn đối chiếu: [architecture.md](../../architecture.md), [decisions/ADR-030-solo-direct-summary-sync.md](../../decisions/ADR-030-solo-direct-summary-sync.md).
