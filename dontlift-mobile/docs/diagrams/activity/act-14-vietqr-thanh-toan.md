# ACT-14 — VietQR và xác nhận đã trả

Không có webhook ngân hàng cho luồng chia hóa đơn; mở ngân hàng hoặc quét QR không tự đổi trạng thái đã trả.

```mermaid
flowchart TD
    A([Member mở phần tiền]) --> B[Đọc phiên bản bill và thông tin nhận còn hạn]
    B --> C{Phần tiền dương và chưa trả?}
    C -->|Không| D[Hiển thị không cần trả hoặc đã xác nhận]
    C -->|Có| E[Tạo VietQR đúng số tiền và nội dung]
    E --> F[Mở ngân hàng hỗ trợ hoặc hiển thị QR]
    F --> G[Người dùng thực hiện chuyển khoản ngoài ứng dụng]
    G --> H[Host đối chiếu giao dịch thực tế]
    H --> I{Host xác nhận đã nhận?}
    I -->|Không| J[Giữ trạng thái chưa xác nhận]
    I -->|Có| K[Transaction cập nhật share, receipt và paid count]
    K --> L[Khóa điều chỉnh sau khoản xác nhận đầu tiên]
    L --> Z([Cập nhật trạng thái cho nhóm])
    D --> Z
    J --> Z
```

Nguồn đối chiếu: [decisions/ADR-023-spark-manual-payment-status.md](../../decisions/ADR-023-spark-manual-payment-status.md), [api-contracts.md](../../api-contracts.md).
