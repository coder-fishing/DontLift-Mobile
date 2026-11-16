# Hướng dẫn API và tích hợp

Ngày đối chiếu: 16/11/2026. Tham chiếu chính: [api-contracts.md](api-contracts.md). Các endpoint dưới đây mô tả hợp đồng, không xác nhận server đã chạy.

## Mục lục

- [Kênh dữ liệu](#kênh-dữ-liệu)
- [API HTTP](#api-http)
- [Lỗi và retry](#lỗi-và-retry)
- [Đọc mã tích hợp](#đọc-mã-tích-hợp)

## Kênh dữ liệu

| Nhu cầu | Kênh |
| --- | --- |
| Đăng nhập | Firebase Authentication |
| Trạng thái phòng | Firestore listeners |
| Thao tác phòng được ADR chấp nhận | Firestore transaction và Security Rules |
| Tổng kết Solo mới | Direct Firestore sync theo ADR-030 |
| Solo từ client cũ | Callable `syncEvents` để tương thích |
| Premium, OCR, ảnh hóa đơn | API HTTP bên ngoài |

Kiểm tra adapter và ADR trước khi dùng một callable còn xuất hiện trong tài liệu cũ.

## API HTTP

Base URL lấy từ `EXPO_PUBLIC_PREMIUM_API_URL`. Các endpoint cần đăng nhập nhận `Authorization: Bearer <Firebase ID token>`. Backend suy ra UID từ token đã xác minh.

| Method | Path | Mục đích |
| --- | --- | --- |
| GET | `/v1/premium/packages` | Danh mục gói |
| POST | `/v1/premium/orders` | Tạo đơn |
| GET | `/v1/premium/orders/current` | Đơn hiện tại của người đăng nhập |
| GET | `/v1/premium/orders/:code` | Đơn cụ thể thuộc người đăng nhập |
| POST | `/v1/premium/orders/current/cancel` | Hủy đơn và đối chiếu payOS |
| POST | `/v1/bills/scan?roomId=...` | Gợi ý số tiền từ ảnh |
| POST | `/v1/bills/evidence?roomId=...` | Tải ảnh chứng từ riêng tư |
| GET | `/v1/bills/evidence?roomId=...&path=...` | URL xem ảnh có thời hạn |
| DELETE | `/v1/bills/evidence?roomId=...&path=...` | Xóa ảnh chưa gắn hóa đơn công bố |

Ví dụ body tạo đơn, dùng UUIDv4 mới cho thao tác mới:

```json
{
  "version": 1,
  "requestId": "7d2ce9c5-76d0-412c-9b55-e70f45f4d52a",
  "packageId": "MONTH_1"
}
```

Không gửi giá, UID hoặc callback URL để quyết định đơn. Backend lấy giá từ danh mục.

Production scan nhận raw image bytes với content type phù hợp. OCR nội bộ khi phát triển nhận multipart field `image`. Hai định dạng không hoán đổi cho nhau.

Scan production yêu cầu Premium còn hạn, Host hiện tại và phòng đã hoàn tất, chốt kết quả. Evidence hỗ trợ JPEG, PNG, WEBP đến 10 MiB. URL tải ảnh riêng tư có hạn năm phút theo hợp đồng.

Webhook `/webhooks/payos` thuộc tích hợp server. Trang return hoặc cancel không cấp Premium.

## Lỗi và retry

Lỗi có mã ổn định, thường theo dạng `{ "version": 1, "code": "..." }`. Ví dụ: `unauthenticated`, `premium-required`, `host-required`, `ocr-unavailable`, `ocr-timeout`.

Giữ request ID khi gửi lại cùng thao tác. Không tạo đơn thanh toán mới chỉ vì mất phản hồi. Không tự retry OCR; cho người dùng nhập tiền thủ công.

Trạng thái thanh toán P2P không tương đương xác minh ngân hàng. Chỉ backend cập nhật entitlement Premium.

## Đọc mã tích hợp

Trong thư mục ứng dụng, đọc `src/features/premium/premium-api.ts`, `src/features/settlement/receipt-scan-api.ts` và `receipt-evidence-api.ts`. Với transaction Firestore, đối chiếu `firestore.rules` và kiểm thử emulator.

Khi báo lỗi, ghi môi trường, endpoint, mã lỗi và request ID. Loại bỏ token, khóa dịch vụ và thông tin ngân hàng khỏi log chia sẻ.
