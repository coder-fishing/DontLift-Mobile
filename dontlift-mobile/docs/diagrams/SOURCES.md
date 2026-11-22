# Nguồn đối chiếu và giới hạn

## Tài liệu

- [AGENTS](../../AGENTS.md): thứ tự ưu tiên tài liệu và giới hạn báo cáo triển khai.
- [PRD](../product-requirements.md), [đặc tả](../feature-specification.md), [kiến trúc hiện hành](../architecture.md), [API](../api-contracts.md).
- [Các ADR](../decisions/): 008 lifecycle; 010 Firebase JS/Expo Go; 011–019 phòng, vi phạm và chốt điểm; 020–023 hóa đơn và xác nhận trả; 024/028 lịch sử; 025/029 Premium; 026/027 phòng chờ; 030 Solo.
- [Kế hoạch OCR](../superpowers/plans/2026-11-14-ai-bill-scan-paddleocr.md) và hợp đồng API cập nhật mô tả private receipt media; phần PRD/spec nói không lưu ảnh là mô tả cũ hơn.

## Mã nguồn đối chiếu

- [Dependencies](../../package.json): React Native, Expo, Firebase JS SDK, Sensors, SQLite, Router.
- [SQLite migrations](../../src/features/local/migrations.ts): bảng, cột thêm sau migration, PK và FK thực tế.
- [Phân loại cảm biến](../../src/features/sensors/phone-down-engine.ts), [grace engine](../../src/features/solo/grace-period-engine.ts), [Solo controller](../../src/features/solo/session-controller.ts).
- [Bill allocation](../../src/features/settlement/bill-allocation.ts), [receipt scan API](../../src/features/settlement/receipt-scan-api.ts), [receipt evidence API](../../src/features/settlement/receipt-evidence-api.ts).
- [Group ranking](../../src/features/rooms/group-active-domain.ts), [Premium API client](../../src/features/premium/premium-api.ts).

## Giới hạn

Sơ đồ không khẳng định thành công về độ chính xác cảm biến, tốc độ đồng bộ, OCR hoặc thanh toán thật. Mã Express, PaddleOCR và cấu hình dịch vụ ở ngoài repository mobile chưa được kiểm tra đầy đủ trong công việc này. Class khái niệm và ERD logic phục vụ giải thích thiết kế, không thay thế schema vật lý hoàn chỉnh. Bảng SQLite trong sơ đồ chỉ trích các cột chính; migrations là nguồn đầy đủ.

Không đưa các chức năng của ảnh tham khảo như Web3, quyên góp, chiến dịch và quản trị dự án vào DontLift. Ảnh chỉ cung cấp gợi ý loại sơ đồ.
