# SEQ-03 — Cảm biến và vi phạm

Dữ liệu cảm biến thô không rời thiết bị; snapshot trạng thái chưa biết không tự chứng minh vi phạm.

```mermaid
sequenceDiagram
    participant S as Expo Sensors
    participant P as Phone-down engine
    participant G as GracePeriodEngine
    participant C as Detection controller
    participant L as SQLite
    S->>P: Mẫu x, y, z
    P-->>C: FACE_DOWN, LIFTED, INVALID hoặc UNKNOWN
    C->>G: observe và snapshot theo thời gian
    alt Candidate chưa đủ 3 giây và trở lại úp
        G-->>C: Hủy candidate
    else Đủ 3 giây
        G-->>C: shouldConfirm
        C->>L: Lưu eventId và thời điểm xác nhận
        L-->>C: Commit
        C->>G: markConfirmed
    end
    opt Có vi phạm đang mở và trở về FACE_DOWN
        G-->>C: shouldEndViolation
        C->>L: Kết thúc vi phạm, ghi thời lượng và outbox phù hợp
        C->>G: markEnded
    end
```

Nguồn đối chiếu: [feature-specification.md](../../feature-specification.md), [decisions/ADR-008-platform-session-lifecycle.md](../../decisions/ADR-008-platform-session-lifecycle.md).
