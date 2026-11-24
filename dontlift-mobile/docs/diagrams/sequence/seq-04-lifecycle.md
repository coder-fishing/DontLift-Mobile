# SEQ-04 — Background và phục hồi

Đây là hợp đồng lifecycle; không khẳng định Expo Go thực thi native background task hoặc WorkManager.

```mermaid
sequenceDiagram
    participant OS as Hệ điều hành
    participant A as Lifecycle adapter
    participant L as SQLite
    participant R as Recovery engine
    OS->>A: inactive hoặc background
    A->>L: Ghi candidate UUID và marker thời gian
    opt Bản dựng có native adapter theo ADR-008
        A->>OS: Đăng ký thời gian nền giới hạn
    end
    OS-->>A: Có thể suspend trước khi timer chạy
    Note over OS,L: Candidate đã bền vững, chưa là vi phạm xác nhận
    OS->>R: Resume hoặc khởi động lại
    R->>L: Đọc candidate chưa giải quyết
    R->>R: Đối chiếu monotonic, UTC và clock anomaly
    alt Elapsed hợp lệ dưới 3 giây
        R->>L: CANCELLED
    else Elapsed hợp lệ từ 3 giây
        R->>L: Confirm một lần theo UUID
    else Không suy ra được thời gian an toàn
        R->>L: NEEDS_REVIEW
    end
```

Nguồn đối chiếu: [decisions/ADR-008-platform-session-lifecycle.md](../../decisions/ADR-008-platform-session-lifecycle.md), [decisions/ADR-010-expo-go-firebase-js.md](../../decisions/ADR-010-expo-go-firebase-js.md).
