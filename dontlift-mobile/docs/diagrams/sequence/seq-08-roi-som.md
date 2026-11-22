# SEQ-08 — Yêu cầu và duyệt rời sớm

Thành viên rời sớm vẫn ở roster phục vụ tổng kết và chia tiền.

```mermaid
sequenceDiagram
    actor M as Member
    actor H as Host
    participant D as Firestore và Rules
    participant L as SQLite của Member
    M->>D: Transaction tạo yêu cầu rời sớm
    D-->>H: Listener yêu cầu mới
    H->>D: Transaction approve hoặc deny
    alt Approve
        D->>D: Cập nhật EARLY_EXIT, cutoff và activeMemberCount
        D-->>M: Snapshot xác nhận rời sớm
        M->>L: Dừng tracking tại cutoff và lưu tổng kết phù hợp
        M->>D: Gửi nốt vi phạm đủ điều kiện trước cutoff
    else Deny
        D-->>M: Tiếp tục ACTIVE
    end
```

Nguồn đối chiếu: [decisions/ADR-015-spark-early-exit.md](../../decisions/ADR-015-spark-early-exit.md).
