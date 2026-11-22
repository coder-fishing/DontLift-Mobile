# SEQ-02 — Hoàn tất và đồng bộ Solo

Tổng kết cá nhân tự báo cáo; không dùng để cấp quyền, chia tiền hay sửa điểm nhóm.

```mermaid
sequenceDiagram
    actor U as Người dùng
    participant C as Solo controller
    participant L as SQLite và outbox
    participant W as Sync worker
    participant D as Firestore và Rules
    U->>C: Bắt đầu phiên
    C->>L: startOrResume
    L-->>C: Session ID ổn định
    Note over C,L: Theo dõi cảm biến và lưu vi phạm cục bộ
    U->>C: Kết thúc hoặc Countdown về 0
    C->>L: Transaction tổng kết và outbox
    C-->>U: Hiển thị tổng kết ngay
    W->>L: Claim mục đến hạn
    W->>D: Đọc users/uid/sessions/sessionId
    alt Chưa tồn tại
        W->>D: Create-only với payloadHash
        D-->>W: Commit
    else Hash giống nhau
        D-->>W: Idempotent success
    else Hash khác
        D-->>W: Conflict
    end
    W->>L: Ghi SYNCED hoặc FAILED tương ứng
```

Nguồn đối chiếu: [decisions/ADR-030-solo-direct-summary-sync.md](../../decisions/ADR-030-solo-direct-summary-sync.md).
