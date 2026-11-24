# ACT-12 — Quét hóa đơn và xác nhận

Luồng production qua Express; development có thể gọi PaddleOCR trong LAN. Lỗi và hủy không tự thay số tiền hiện có. Không lưu OCR thô.

```mermaid
flowchart TD
    A([Host nhập hóa đơn]) --> B{Premium còn hạn?}
    B -->|Không| C[Nhập tay hoặc xem gói Premium]
    B -->|Có| D[Chụp ảnh hoặc chọn thư viện]
    D --> E{Hủy hoặc từ chối quyền?}
    E -->|Có| C
    E -->|Không| F[Kiểm tra JPEG, PNG, WEBP và giới hạn dung lượng]
    F --> G[Gửi yêu cầu nhận diện]
    G --> H{Có gợi ý phù hợp?}
    H -->|Không hoặc lỗi| C
    H -->|Có| I[Hiển thị số tiền, căn cứ và cảnh báo]
    I --> J{Host chấp nhận số tiền từ 1000 VND?}
    J -->|Không| C
    J -->|Có| K[Tải ảnh đã chấp nhận vào kho riêng tư]
    K --> L{Tải ảnh thành công?}
    L -->|Có| N[Điền số tiền và giữ evidencePath]
    L -->|Không| P[Giữ số tiền cũ và hiển thị lỗi lưu ảnh]
    P --> Q{Host chọn cách tiếp tục?}
    Q -->|Thử lại| K
    Q -->|Không kèm ảnh| R[Áp dụng gợi ý, không gắn ảnh]
    Q -->|Nhập tay| C
    N --> M[Xem trước phần chia, chưa tự công bố]
    R --> M
    C --> M
    M --> Z([Tiếp tục quy trình hóa đơn])
```

Nguồn đối chiếu: [api-contracts.md](../../api-contracts.md).
