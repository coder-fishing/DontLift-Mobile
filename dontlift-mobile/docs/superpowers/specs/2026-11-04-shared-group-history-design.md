# Lịch sử phòng nhóm trong tài khoản từng thành viên

## Mục tiêu

Sau khi phiên nhóm kết thúc, từng người đã tham gia có thể mở tab History bằng tài khoản của mình, tìm phòng đó và xem kết quả chung của nhóm. Dữ liệu cá nhân cũ, điểm canonical của phòng, giới hạn lưu trữ và các quyền thanh toán hiện có tiếp tục được áp dụng.

## Hợp đồng dữ liệu

- Mỗi tài khoản có `users/{uid}/groupRooms/{roomId}` làm chỉ mục các phòng mà tài khoản đó đã tham gia.
- Chỉ client đang xác thực đúng UID mới được tạo và đọc chỉ mục của UID đó. Sau khi tạo/tham gia phòng đã commit, client ghi chỉ mục theo cách best-effort; `joinedAt` phải bằng timestamp membership được Rules xác nhận. Lỗi ghi index không biến thao tác phòng đã thành công thành thất bại.
- Chỉ mục không chứa điểm, hóa đơn hoặc thông tin thanh toán. Nó chỉ chứa `roomId` và `joinedAt`.
- History truy vấn chỉ mục của tài khoản, sau đó tải room và membership của chính UID đó. Chỉ phòng terminal có membership `ACTIVE` hoặc `EARLY_EXIT` mới được hiển thị.
- Dữ liệu chung trong detail lấy từ room, roster, điểm canonical và bill hiện có; không đọc lịch sử riêng của tài khoản khác.
- Bản ghi chỉ mục không thay thế personal summary/outbox hiện có. Khi personal summary đã có thì giữ nguyên; nếu chưa có thì có thể dựng mục History từ điểm và thời gian canonical của membership.

## Quy tắc phục hồi

- Khi đọc History online, sửa chỉ mục còn thiếu cho phòng mà thiết bị hiện tại đã cache và tài khoản vẫn là thành viên hợp lệ.
- Thiết bị mới chỉ khôi phục các phòng có chỉ mục cloud; không hứa khôi phục lịch sử cũ chưa từng được lập chỉ mục.
- Phòng chưa kết thúc, membership bị xóa hoặc không đọc được do không còn quyền sẽ không xuất hiện trong History.
- Offline tiếp tục hiển thị personal summary/cached details đã có; không dựng dữ liệu chung mới từ clock thiết bị.

## Bảo mật và phạm vi

- Không thêm Cloud Function, collection công khai, room query rộng, hoặc quyền đọc `users/{otherUid}`.
- Không thay đổi canonical scoring, reconciliation, thanh toán, retention hay Premium entitlement.
- Firestore Rules chỉ cho owner đọc index; create/update chỉ được chấp nhận khi membership của chính owner tồn tại và khớp room.

## Chấp nhận

- Host và từng member mới tham gia đều có chỉ mục của riêng mình sau khi thao tác phòng commit.
- Sau khi room terminal, mỗi member còn hợp lệ thấy cùng room trong History; detail hiển thị roster/kết quả chung nhưng điểm cá nhân của họ lấy từ membership canonical.
- Outsider không tạo/đọc index hoặc room detail.
- Personal summary pending/failed vẫn được giữ; việc đọc room index không đánh dấu outbox là synced.
- Room đã cache trên thiết bị cũ có thể được backfill khi History tải; dữ liệu không được dựng nếu membership không còn hợp lệ.
