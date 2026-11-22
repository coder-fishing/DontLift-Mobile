# ACT-04 — Xác nhận vi phạm 3 giây

Đã đọc GracePeriodEngine: mẫu FACE_DOWN đến sau hạn vẫn phải xác nhận vi phạm đủ điều kiện, không được hủy chỉ vì điện thoại vừa úp lại.

```mermaid
flowchart TD
    A([Có mẫu cảm biến]) --> B[Phân loại hướng điện thoại]
    B --> C{UNKNOWN?}
    C -->|Có| D[Không xác nhận từ mẫu chưa biết]
    C -->|Không| E{FACE_DOWN?}
    E -->|Không| F[Bắt đầu hoặc tiếp tục candidate]
    F --> G{Đủ 3000 ms?}
    G -->|Chưa| Z([Chờ mẫu hoặc tick tiếp theo])
    G -->|Đủ| H{Đã có vi phạm đang mở?}
    H -->|Chưa| I[Lưu vi phạm bằng eventId ổn định]
    H -->|Rồi| Z
    I --> Z
    E -->|Có| J{Candidate đã đủ 3000 ms?}
    J -->|Có| K[Xác nhận trước khi đóng vi phạm]
    J -->|Không| L[Hủy candidate chưa đủ hạn]
    K --> M[Đóng vi phạm và ghi thời lượng]
    L --> N{Có vi phạm đang mở?}
    N -->|Có| M
    N -->|Không| Z
    M --> Z
    D --> Z
```

Nguồn đối chiếu: [feature-specification.md](../../feature-specification.md), [decisions/ADR-008-platform-session-lifecycle.md](../../decisions/ADR-008-platform-session-lifecycle.md).
