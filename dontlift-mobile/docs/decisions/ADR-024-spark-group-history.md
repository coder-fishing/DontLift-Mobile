# ADR-024 — Lịch sử nhóm trên Spark

Trạng thái: Accepted, human duyệt D4/phương án Spark ngày 2026-10-22.

Dùng thiết kế `docs/superpowers/specs/2026-10-22-sl-028-group-history-spark-design.md` đã duyệt. Không Functions, billing hoặc production deploy.

## Quyết định

- Identity là (actorUid, roomId). Sau khi capture/lifecycle drain và normalization kết thúc, lưu thống kê local và GROUP_SESSION_LOCAL_SUMMARY outbox cùng transaction SQLite. Event UUID được giữ ổn định qua restart/retry.
- Cutoff chỉ lấy từ server đã quan sát: earlyExitAt, hoặc terminal endedAt; early exit dùng mốc sớm hơn khi cả hai có mặt. Không tự kết thúc do mất mạng. Giữ riêng EARLY_EXIT, COMPLETED, CANCELLED, ABORTED. Timestamp trong personal summary dùng số milliseconds nguyên; không thay server authority.
- Sync owner-only vào users/{uid}/groupHistory/{roomId} bằng client transaction và Firestore Rules Standard. Exact receipt replay/no-op; giữ identity và event ID ổn định. Cho phép sửa hẹp status sang EARLY_EXIT và/hoặc giảm cutoff theo authority hiện tại; không tăng thống kê, không sửa điểm canonical/bill. Những thay đổi khác bị collision. Rules xác minh membership, cutoff, trường và giới hạn; thống kê là device-reported, không chứng minh đủ sensor events.
- Bản ghi cá nhân không thay đổi canonical room, member scores hoặc bill. Lịch sử đọc local trước; index cloud phân trang theo completedAtUtcMs DESC, document ID DESC. Canonical detail đọc riêng theo membership hiện có; ghi rõ pending/finalized/cached/error.
- Sync độc lập màn hình, có retry khi khởi tạo/reconnect/foreground và explicit retry; ACK local chỉ commit sau backend success. Một event lỗi không chặn các phòng tiếp theo. Đổi tài khoản phải chặn callbacks cũ và không xử lý outbox của tài khoản khác.
- Free hiển thị 7 ngày, pending/failed vẫn thấy; Local Premium mở local visibility, verified Server Premium mở cloud visibility. Đây là UI visibility của private owner index, không phải server-enforced deletion. SL-033 sở hữu purge; không tự xóa dữ liệu ở đây.
- Thiết bị thứ hai phục hồi index đã upload và canonical detail còn được phép đọc; không thể tìm phiên chưa bao giờ upload. Không cache thông tin tài khoản ngân hàng/QR.

## Giới hạn

Local summary là snapshot recording cá nhân, không thay điểm đã chốt. Rule expiry của settlement/share không được nới. Không mở collection rooms cho query lịch sử. Không queue completeRoom/ACK/payment/vote commands. Physical Expo Go verification tách khỏi unit/Emulator evidence.

## Review correction — terminal membership và cutoff đến muộn

Trước upload, đọc room và own membership trong cùng Firestore transaction; không coi tổ hợp hai listener là snapshot nguyên tử. SQLite summary/outbox có thể sửa cùng event ID theo authority này. EARLY_EXIT đã sync tiếp tục được kiểm tra bởi worker độc lập cho đến khi quan sát terminal room (cờ durable terminal_confirmed, migration 11). Nếu abort backdate trước earlyExitAt, dùng min hai mốc, clamp các local interval và bỏ interval chưa qua grace. Không tăng counts/duration khi sửa; thiếu raw intervals thì giữ lỗi để retry, không tự tạo thống kê 0.

Rules chỉ cho sửa status sang EARLY_EXIT và/hoặc cutoff sớm hơn đúng authority hiện tại; identity/start/event ID giữ nguyên, counts/duration không tăng, status-only giữ nguyên thống kê. Cấm sửa tùy ý hoặc delete. ACK/failure local kiểm tra payload vẫn khớp để kết quả upload cũ không ghi đè summary đã chuẩn hóa.
