# ACT-07 — Rời hoặc loại thành viên phòng chờ

Quyền loại chỉ ở WAITING. Rules kiểm tra chuyển quyền nguyên tử, không chứng minh thuật toán chọn thành viên sớm nhất.

```mermaid
flowchart TD
    A([Phòng WAITING, có mạng]) --> B{Hành động?}
    B -->|Tự rời| C{Người rời là Host?}
    C -->|Không| D[Xóa membership của chính mình và giảm count]
    C -->|Có| E{Còn thành viên khác?}
    E -->|Có| F[Chọn người nhận theo joinedAt và UID]
    F --> G[Transaction chuyển Host, xóa người rời, giảm count]
    E -->|Không| H[Transaction hủy phòng và xóa Host cuối]
    B -->|Loại người khác| I{Caller là Host và đích là MEMBER?}
    I -->|Không| J[Từ chối]
    I -->|Có| K[Xác nhận loại, có thể tham gia lại]
    K --> L[Transaction xóa đích và giảm count]
    D --> M[Chờ server xác nhận rồi dọn cache]
    G --> M
    H --> M
    L --> N[Thiết bị đích xử lý listener server-confirmed]
    N --> Z([Cập nhật màn hình])
    M --> Z
    J --> Z
```

Nguồn đối chiếu: [decisions/ADR-026-spark-lobby-leave-host-transfer.md](../../decisions/ADR-026-spark-lobby-leave-host-transfer.md), [decisions/ADR-027-spark-lobby-member-removal.md](../../decisions/ADR-027-spark-lobby-member-removal.md).
