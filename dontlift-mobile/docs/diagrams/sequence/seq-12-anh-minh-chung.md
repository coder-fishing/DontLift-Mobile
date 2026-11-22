# SEQ-12 — Ảnh hóa đơn riêng tư

Tài nguyên chưa công bố có thể được Host yêu cầu xóa qua API; tài nguyên đã liên kết bill không được xóa bằng luồng này.

```mermaid
sequenceDiagram
    actor H as Host
    participant A as Mobile
    participant E as Express API
    participant C as Cloudinary private media
    participant D as Firestore
    actor M as Member
    H->>A: Chấp nhận gợi ý OCR
    A->>E: POST bills/evidence với ảnh và roomId
    E->>D: Xác minh Premium Host và room FINALIZED
    E->>C: Upload private media
    C-->>E: evidencePath
    E-->>A: evidencePath
    A->>D: Gắn path vào lần công bố bill
    M->>E: GET bills/evidence theo room và path
    E->>D: Kiểm tra membership và path đã công bố
    E->>C: Tạo URL tải riêng tư 5 phút
    E-->>M: URL có thời hạn
    M->>C: Xem ảnh
    Note over A,D: Không lưu URL ngắn hạn hoặc OCR thô trong Firestore
```

Nguồn đối chiếu: [api-contracts.md](../../api-contracts.md).
