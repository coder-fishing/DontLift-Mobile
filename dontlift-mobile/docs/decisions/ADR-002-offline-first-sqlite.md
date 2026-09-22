# ADR-002: Offline-First SQLite Reconciliation và durable event outbox

## Status

Accepted

## Context

`Solo Focus Mode` phải hoạt động không cần mạng. `Group Room Mode` cần mạng để create/join nhưng phải tiếp tục `Phone-Down Detection` và ghi event khi kết nối bị gián đoạn. Mọi event phải được lưu trước khi sync, retry an toàn và không tạo duplicate backend effects.

Background execution trên Android/iOS là opportunistic, không bảo đảm chạy đúng giờ. Firestore native cache không thay thế domain outbox vì app cần per-event metadata, acknowledgment, retry và retention rõ ràng.

## Decision

Dùng SQLite cho typed domain records và bảng `sync_outbox` dùng chung.

Mỗi offline-capable event được ghi bằng một SQLite transaction chứa:

1. Typed domain record.
2. Outbox envelope có `event_id`, `event_type`, `schema_version`, aggregate/session references, actor, occurrence timestamp, payload, sync status, retry metadata và lease.

Initial event allowlist:

- `VIOLATION_RECORDED`
- `SOLO_SESSION_COMPLETED`
- `GROUP_SESSION_LOCAL_SUMMARY`

State machine:

- `PENDING → IN_FLIGHT → SYNCED`
- Transient failure: `IN_FLIGHT → PENDING`
- Expired lease after crash: `IN_FLIGHT → PENDING`
- Permanent validation/authorization rejection: `IN_FLIGHT → REJECTED`

Worker chạy sau local commit khi online, network recovery, startup, auth restore, app resume và opportunistic background task. Events giữ ordering trong cùng aggregate và được gửi theo bounded batches.

Backend `syncEvents` tạo at-least-once delivery với idempotent effect bằng server-only `syncReceipts/{eventId}` và Firestore transaction. Receipt lưu payload hash; cùng ID và khác hash bị reject.

Success được đánh dấu `SYNCED` bền vững trước khi outbox payload được purge. Domain record có retention riêng. Free-tier `Violation Log` dùng 7-day purge; premium history không dùng free-tier purge.

## Consequences

### Positive

- Mất mạng hoặc app restart không làm mất event đã commit.
- Retry và partial batch acknowledgment rõ ràng.
- Duplicate delivery không cộng score hai lần.
- Một cơ chế đồng bộ dùng chung cho nhiều event type.
- Không cần external queue service.

### Negative

- Firestore cache và SQLite projection cần explicit precedence.
- Generic JSON payload cần versioned validators.
- Receipt collection tăng theo số event và cần TTL.
- Event có permanent rejection cần diagnostics và retention thay vì retry vô hạn.
- Exactly-once network delivery không được bảo đảm; chỉ idempotent backend effect được bảo đảm.

## Alternatives considered

### Chỉ dùng Firestore native offline writes

Loại vì tạo queue thứ hai không có application-level envelope, acknowledgment hoặc retention contract và không phục vụ Solo-only local domain data.

### Chỉ dùng `violation_logs.sync_status`

Loại vì trộn domain record với transport state và không mở rộng sạch cho session summary hoặc event type khác.

### Queue mọi user command

Loại vì vote, lifecycle, bill và payment commands có thể hết hạn hoặc không còn hợp lệ khi replay muộn.

## Source

- PRD FR-02, FR-03 và NFR Offline Resilience/Sync Reliability/Idempotency.
- Feature Spec Sections 4.1, 4.2, 5.3, 6 và 7.
- Approved requirement ngày 2026-09-22 về unexpected network loss, local event metadata, automatic synchronization và idempotent backend processing.
