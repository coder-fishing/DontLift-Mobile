# ADR-024 — Lịch sử nhóm trên Spark

Trạng thái: Accepted, human duyệt D4/phương án Spark ngày 2026-10-22.

Dùng thiết kế `docs/superpowers/specs/2026-10-22-sl-028-group-history-spark-design.md` đã duyệt. Không Functions, billing hoặc production deploy.

## Quyết định

- Identity là (actorUid, roomId). Sau khi capture/lifecycle drain và normalization kết thúc, lưu thống kê local và GROUP_SESSION_LOCAL_SUMMARY outbox cùng transaction SQLite. Event UUID được giữ ổn định qua restart/retry.
- Cutoff chỉ lấy từ server đã quan sát: earlyExitAt, hoặc terminal endedAt; early exit dùng mốc sớm hơn khi cả hai có mặt. Không tự kết thúc do mất mạng. Giữ riêng EARLY_EXIT, COMPLETED, CANCELLED, ABORTED. Timestamp trong personal summary dùng số milliseconds nguyên; không thay server authority.
- Sync owner-only vào users/{uid}/groupHistory/{roomId} bằng client transaction và Firestore Rules Standard. Create-only, exact receipt replay/no-op; payload khác cùng identity bị collision. Rules xác minh membership, cutoff, trường và giới hạn; thống kê là device-reported, không chứng minh đủ sensor events.
- Bản ghi cá nhân không thay đổi canonical room, member scores hoặc bill. Lịch sử đọc local trước; index cloud phân trang theo completedAtUtcMs DESC, document ID DESC. Canonical detail đọc riêng theo membership hiện có; ghi rõ pending/finalized/cached/error.
- Sync độc lập màn hình, có retry khi khởi tạo/reconnect/foreground và explicit retry; ACK local chỉ commit sau backend success. Một event lỗi không chặn các phòng tiếp theo. Đổi tài khoản phải chặn callbacks cũ và không xử lý outbox của tài khoản khác.
- Free hiển thị 7 ngày, pending/failed vẫn thấy; Local Premium mở local visibility, verified Server Premium mở cloud visibility. Đây là UI visibility của private owner index, không phải server-enforced deletion. SL-033 sở hữu purge; không tự xóa dữ liệu ở đây.
- Thiết bị thứ hai phục hồi index đã upload và canonical detail còn được phép đọc; không thể tìm phiên chưa bao giờ upload. Không cache thông tin tài khoản ngân hàng/QR.

## Giới hạn

Local summary là snapshot recording cá nhân, không thay điểm đã chốt. Rule expiry của settlement/share không được nới. Không mở collection rooms cho query lịch sử. Không queue completeRoom/ACK/payment/vote commands. Physical Expo Go verification tách khỏi unit/Emulator evidence.
