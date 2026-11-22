# SEQ-13 — Công bố phần chia theo từng đợt

Rules xác minh quyền, trạng thái và cấu trúc; không xác minh toàn bộ phép chia hay tính đầy đủ roster.

```mermaid
sequenceDiagram
    actor H as Host
    participant A as Bill allocation và repository
    participant D as Firestore và Rules
    participant M as Member listeners
    H->>A: Xác nhận tổng tiền và preview
    A->>D: Đọc FINALIZED scores và settlement details
    A->>A: Tính integer shares và kiểm tra exact sum
    A->>D: Transaction tạo preparation manifest và khóa phòng
    loop Mỗi đợt tối đa 8 share
        A->>D: Stage shares với requestId
    end
    Note over D,M: Shares đang stage chưa hiển thị cho Member
    A->>D: Transaction publish metadata, manifest và immutable receipt
    D-->>M: Kết quả đã công bố
    alt Mất response hoặc khởi động lại
        A->>D: Đọc manifest và receipt cùng requestId
        D-->>A: Tiếp tục hoặc replay kết quả đã commit
    end
```

Nguồn đối chiếu: [decisions/ADR-021-spark-default-bill.md](../../decisions/ADR-021-spark-default-bill.md), [api-contracts.md](../../api-contracts.md).
