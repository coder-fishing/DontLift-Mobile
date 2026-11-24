# STM-03 — Candidate lifecycle bền vững

Không vẽ NEEDS_REVIEW tự chuyển sang CONFIRMED khi chưa có hợp đồng xử lý. CONFIRMED liên kết cùng UUID với vi phạm để chống trùng.

```mermaid
stateDiagram-v2
    [*] --> PENDING: Rời foreground, commit candidate
    PENDING --> CANCELLED: Quay lại trước 3 giây
    PENDING --> CONFIRMED: Elapsed hợp lệ từ 3 giây
    PENDING --> NEEDS_REVIEW: Clock anomaly hoặc marker không an toàn
    CANCELLED --> [*]
    CONFIRMED --> [*]
    NEEDS_REVIEW --> [*]: Giữ bản ghi chờ xử lý phù hợp
```

Nguồn đối chiếu: [decisions/ADR-008-platform-session-lifecycle.md](../../decisions/ADR-008-platform-session-lifecycle.md).
