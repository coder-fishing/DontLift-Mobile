# Tài liệu sản phẩm DontLift

Ngày đối chiếu: 16/11/2026. Đọc cùng [yêu cầu sản phẩm](product-requirements.md) và [đặc tả tính năng](feature-specification.md).

## Mục lục

- [Mục tiêu](#mục-tiêu)
- [Vai trò](#vai-trò)
- [Hành trình chính](#hành-trình-chính)
- [Giới hạn và nghiệm thu](#giới-hạn-và-nghiệm-thu)

## Mục tiêu

Điện thoại dễ làm gián đoạn việc học, công việc và cuộc trò chuyện. DontLift giúp người dùng đặt ra một khoảng tập trung và nhìn lại số lần sử dụng điện thoại trong khoảng đó. Với nhóm, kết quả còn hỗ trợ việc chia hóa đơn.

## Vai trò

| Vai trò | Nhu cầu |
| --- | --- |
| Người dùng Solo | Bắt đầu phiên riêng và xem kết quả |
| Host | Tạo phòng, điều phối phiên và công bố hóa đơn |
| Member | Tham gia phòng, theo dõi kết quả và xem phần tiền |

Host và Member là vai trò trong từng phòng. Một người có thể giữ vai trò khác nhau ở các phiên khác nhau.

## Hành trình chính

**Solo:** đăng nhập, chọn bộ đếm, bắt đầu phiên và đặt điện thoại úp xuống. Ứng dụng ghi vi phạm, hiển thị tổng kết và đồng bộ lịch sử khi đủ điều kiện.

**Nhóm:** Host tạo phòng và chia sẻ mã mời. Thành viên tham gia bằng PIN hoặc QR. Host bắt đầu khi nhóm sẵn sàng. Trong phiên có luồng rời sớm và biểu quyết kết thúc theo điều kiện của phòng.

**Hóa đơn:** sau khi phiên hoàn tất và kết quả được chốt, Host nhập tổng tiền hoặc xác nhận số OCR gợi ý. Host kiểm tra phần chia trước khi công bố. Thành viên chuyển khoản bằng ứng dụng ngân hàng.

**Premium:** người dùng chọn gói và thanh toán qua payOS. Backend xác minh rồi cấp quyền có thời hạn. [ADR-025](decisions/ADR-025-payos-expiring-premium.md) và [ADR-029](decisions/ADR-029-premium-pricing-update.md) thay thế mô hình trọn đời trong tài liệu ban đầu.

## Giới hạn và nghiệm thu

Ứng dụng không khóa hệ điều hành. Camera phục vụ mã mời và hóa đơn, không giám sát người dùng tập trung. OCR chỉ gợi ý; Host kiểm tra số tiền trước khi xác nhận. DontLift không giữ tiền của nhóm.

Mã nguồn hiện có các module Auth, Solo, phòng, lịch sử, hóa đơn và Premium. Cần xác nhận riêng tình trạng triển khai dịch vụ bên ngoài và kết quả kiểm thử thực tế.

Khi nghiệm thu, dùng tài khoản Host và Member riêng. Kiểm tra mất mạng, quyền bị từ chối, gửi lại thao tác và mở lại ứng dụng. Tiêu chí chi tiết nằm trong yêu cầu sản phẩm và đặc tả. Việc có màn hình chưa chứng minh tính năng đã hoàn thành.
