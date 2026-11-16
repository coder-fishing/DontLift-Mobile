# Hướng dẫn đọc và bảo trì mã nguồn

Ngày đối chiếu: 16/11/2026. Các đường dẫn bên dưới tính từ thư mục `dontlift-mobile/`.

## Mục lục

- [Điểm bắt đầu](#điểm-bắt-đầu)
- [Module chính](#module-chính)
- [Lần theo một lỗi](#lần-theo-một-lỗi)
- [Quy ước bảo trì](#quy-ước-bảo-trì)

## Điểm bắt đầu

Manifest dùng `expo-router/entry`. Đọc [src/app/_layout.tsx](../src/app/_layout.tsx) để hiểu phần bọc ứng dụng. Sau đó đọc [src/app/index.tsx](../src/app/index.tsx) để xem cách nối Auth, repository, listeners và màn hình.

Entry hiện điều phối nhiều màn hình được import từ `src/screens/`. Không giả định mỗi màn hình là một route riêng.

## Module chính

| Thư mục trong `src/features/` | Trách nhiệm | Điểm cần chú ý |
| --- | --- | --- |
| `auth/` | Auth, profile, runtime config | SDK quản lý phiên; không tự lưu refresh token |
| `local/` | SQLite và migration | Giữ khả năng đọc dữ liệu phiên bản cũ |
| `sensors/` | Adapter và trạng thái cảm biến | Tách dữ liệu thô khỏi nghiệp vụ |
| `solo/` | Phiên cá nhân | Giữ tổng kết và outbox nhất quán |
| `rooms/` | Phòng, thành viên, vòng đời nhóm | Transaction phải phù hợp Rules và ADR |
| `sync/` | Outbox, worker và cổng đồng bộ | ID ổn định; phân biệt retry với xung đột |
| `history/` | Lịch sử và dữ liệu danh sách | Lịch sử cá nhân không thay dữ liệu nhóm chính thức |
| `settlement/` | Hóa đơn, OCR, chứng từ | Số tiền dùng số nguyên VND |
| `bank-transfer/` | Tích hợp chuyển khoản | Deeplink không chứng minh thanh toán thành công |
| `premium/` | API và entitlement | Quyền phụ thuộc thời hạn do backend quản lý |
| `profile/`, `settings/` | Hồ sơ và tùy chọn | Không ghi đè trường entitlement |

## Lần theo một lỗi

Ví dụ khi lịch sử Solo chưa lên cloud:

1. Đọc `src/screens/SoloSummaryScreen.tsx`.
2. Tìm nơi tạo tổng kết trong `src/app/index.tsx`.
3. Đọc phần lưu SQLite và `src/features/sync/outbox-repository.ts`.
4. Đọc `sync-worker.ts` và `firestore-solo-sync-port.ts` trong cùng module.
5. Đối chiếu `firestore.rules` với [ADR-030](decisions/ADR-030-solo-direct-summary-sync.md).
6. Tìm kiểm thử theo tên module trong `__tests__/` và `functions/tests/`.

Phân biệt lỗi lưu cục bộ, xác thực, Rules và xung đột payload. Không dùng cùng một cách retry cho mọi trường hợp.

## Quy ước bảo trì

- Dùng TypeScript có kiểu rõ ràng. Giải thích boundary nếu bắt buộc dùng `any`.
- Đặt nghiệp vụ cảm biến, scoring, persistence và chia tiền ngoài screen components.
- Dùng token trong `src/constants/theme.ts` cho giao diện.
- Tái sử dụng repository và adapter hiện có trước khi thêm đường dữ liệu mới.
- Viết comment để giải thích lý do, điều kiện bất biến hoặc giới hạn nền tảng.
- Cập nhật tài liệu và kiểm thử liên quan khi thay hợp đồng.

Chạy type-check, lint và kiểm thử phù hợp với phạm vi thay đổi. Lệnh nằm trong [README](../../README.md#kiểm-tra-chất-lượng). Đọc [AGENTS.md](../AGENTS.md) để xem đầy đủ quy ước.
