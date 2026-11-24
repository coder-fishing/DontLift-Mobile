# SEQ-11 — PaddleOCR qua Express trong production

Development gọi trực tiếp PaddleOCR qua LAN được mô tả ở sơ đồ triển khai riêng. OCR không tự điền hay công bố bill.

```mermaid
sequenceDiagram
    actor H as Host Premium
    participant A as Mobile
    participant E as Express API
    participant D as Firebase Admin và Firestore
    participant O as PaddleOCR
    H->>A: Chụp hoặc chọn ảnh
    A->>E: POST bills/scan, roomId, Bearer token và bytes
    E->>D: Xác minh token, expiry, Host, membership và FINALIZED
    alt Không đủ quyền hoặc ảnh sai
        E-->>A: Lỗi đã làm sạch
    else Đủ điều kiện
        E->>O: Multipart image và khóa server-only
        alt Dịch vụ phản hồi hợp lệ
            O-->>E: amount, suggested_amount, warnings và evidence
            E-->>A: Gợi ý VND, needs_confirmation
            A-->>H: Yêu cầu đối chiếu và xác nhận
        else Timeout hoặc lỗi
            E-->>A: Lỗi OCR, không tự retry
            A-->>H: Giữ số tiền hiện tại và cho nhập tay
        end
    end
```

Nguồn đối chiếu: [api-contracts.md](../../api-contracts.md).
