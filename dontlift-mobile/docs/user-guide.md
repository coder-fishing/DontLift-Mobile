# Hướng dẫn sử dụng DontLift

Ngày đối chiếu: 16/11/2026. Hướng dẫn dựa trên màn hình và hợp đồng trong repository. Premium và OCR cần dịch vụ bên ngoài được cấu hình.

## Mục lục

- [Chuẩn bị](#chuẩn-bị)
- [Tập trung cá nhân](#tập-trung-cá-nhân)
- [Tập trung cùng nhóm](#tập-trung-cùng-nhóm)
- [Hóa đơn và thanh toán](#hóa-đơn-và-thanh-toán)
- [Xử lý sự cố](#xử-lý-sự-cố)

## Chuẩn bị

Đăng ký hoặc đăng nhập bằng tài khoản của bạn. Cho phép quyền cần thiết khi ứng dụng yêu cầu. Mở phần chẩn đoán phần cứng nếu cảm biến chưa sẵn sàng.

Đặt điện thoại trên mặt phẳng ổn định. Hệ điều hành có thể giới hạn việc theo dõi khi ứng dụng chuyển nền hoặc bị đóng.

## Tập trung cá nhân

1. Mở chế độ Solo.
2. Chọn bộ đếm và thời lượng phù hợp.
3. Bắt đầu phiên.
4. Đặt điện thoại úp xuống.
5. Xem thời gian, vi phạm và điểm phạt khi kết thúc.
6. Mở lịch sử để xem các phiên trước.

Ứng dụng áp dụng khoảng chờ ba giây cho trạng thái không hợp lệ theo quy tắc phiên. Chuyển nền và khôi phục phiên còn phụ thuộc nền tảng.

Tổng kết được giữ cục bộ trước khi đồng bộ. Khi mạng trở lại, kiểm tra trạng thái đồng bộ. Dùng thao tác thử lại khi giao diện cung cấp.

## Tập trung cùng nhóm

### Dành cho Host

1. Tạo phòng.
2. Chia sẻ PIN hoặc QR mời.
3. Kiểm tra danh sách trong phòng chờ.
4. Bắt đầu khi nhóm sẵn sàng.
5. Theo dõi phiên và xử lý yêu cầu rời sớm.
6. Xem tổng kết khi phiên kết thúc.

### Dành cho Member

1. Nhập PIN hoặc quét QR mời.
2. Kiểm tra đúng phòng trước khi tham gia.
3. Chờ Host bắt đầu.
4. Đặt điện thoại úp xuống trong phiên.
5. Gửi yêu cầu rời sớm nếu cần.

Rời sớm cần Host xử lý. Biểu quyết kết thúc là luồng riêng. Đóng ứng dụng không thay thế hai thao tác này.

## Hóa đơn và thanh toán

Host nhập thông tin nhận tiền và tổng hóa đơn theo luồng ứng dụng. Khi quét ảnh, kiểm tra số tiền gợi ý trước khi xác nhận. Ảnh mờ hoặc hóa đơn có nhiều tổng phụ có thể cho kết quả sai.

Host kiểm tra phần chia trước khi công bố. Sau khi có thanh toán, ứng dụng giới hạn chỉnh sửa theo quy tắc hóa đơn.

Thành viên mở phần tiền của mình. Kiểm tra tên người nhận, số tài khoản, số tiền và nội dung chuyển khoản. Hoàn tất giao dịch trong ứng dụng ngân hàng.

Trạng thái đánh dấu đã trả chỉ là ghi nhận trong DontLift. Host đối chiếu tiền nhận thực tế. DontLift không giữ tiền của nhóm.

Với Premium, chờ backend xác nhận thanh toán và ứng dụng cập nhật quyền. Quay lại từ trang thanh toán chưa có nghĩa giao dịch đã được xác minh.

## Xử lý sự cố

| Tình huống | Cách xử lý |
| --- | --- |
| Không vào được phòng | Kiểm tra mã mời, mạng và trạng thái phòng với Host |
| Cảm biến chưa sẵn sàng | Kiểm tra quyền và mục chẩn đoán phần cứng |
| Lịch sử chưa đồng bộ | Kiểm tra mạng, tài khoản và trạng thái thử lại |
| OCR không hoạt động | Nhập tổng tiền thủ công |
| Đã chuyển khoản nhưng chưa ghi nhận | Cung cấp thông tin giao dịch cho Host để đối chiếu |
| Premium chưa cập nhật sau khi mua | Kiểm tra trạng thái đơn bằng đúng tài khoản đã mua |

Khi báo lỗi, ghi thao tác, thời điểm và thông báo hiển thị. Che thông tin ngân hàng và dữ liệu cá nhân trước khi chia sẻ ảnh chụp.
