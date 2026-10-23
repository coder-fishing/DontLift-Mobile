# ADR-025 — Premium có hạn qua payOS và Express trên Firebase Spark

## Status

Accepted — user duyệt thiết kế/spec và implementation plan ngày 2026-10-23. Supersedes ADR-007 về activation/checksum và hai lớp entitlement. Không thay các quyết định D10/retention chưa chốt.

## Decision

Một Premium có hạn, mua online một lần qua payOS: 89.000/178.000/356.000/623.000 VND nhận 1/3/6/12 tháng lịch. Không tự gia hạn. Cộng từ max(backend now, expiry cũ), theo Asia/Ho_Chi_Minh, giữ giờ và clamp ngày cuối tháng.

Express backend chạy ngoài Firebase Functions, xác minh Firebase ID token và tạo checkout bằng giá server. Firestore giữ Spark và là database duy nhất. Credentials payOS/Admin nằm trong backend secrets; app chỉ có API origin. Không tự bật Firebase billing hoặc deploy production.

payOS webhook phải qua SDK signature verification; backend đối chiếu order, amount VND, link ID và trạng thái PAID đọc qua payOS authenticated API. Một Firestore transaction ghi payment receipt trên order và gia hạn `users/{uid}.premiumExpiresAt`. Duplicate callback trả lại kết quả đã commit. Các đơn khác nhau cộng nối qua transaction, không last-write-wins.

`premiumExpiresAt` là authority. Firestore Rules dùng `request.time < premiumExpiresAt`; boolean `isPremium` cũ không đủ cấp quyền. Client chỉ chiếu/cache expiry để hiển thị và local history context, không tự ghi entitlement. Không scheduler nào cần thiết để hết hạn quyền server. Profile editing giữ nguyên các field server.

Tạo checkout có requestId theo owner, reserve orderCode trước network. Retry cùng payload giữ cùng mã đơn; khác payload conflict. Mất response upstream được phục hồi bằng đọc link theo orderCode. App lưu identity retry theo UID và khôi phục current order sau restart; redirect return/cancel không cấp Premium.

## Consequences

Firebase vẫn Spark; host Express cần public HTTPS và tài khoản/credentials riêng. Free hosting limits/sleep cần kiểm tra trước deploy. Chưa có keys/host thì checkout live chưa khả dụng. payOS cần Client ID, API Key, Checksum Key; thêm Firebase Admin credentials và webhook registration.

Client build cũ chỉ đọc isPremium có thể hiển thị sai sau expiry; cloud Rules vẫn từ chối server benefits. User profile có isPremium true thiếu expiry không nhận quyền mới; không tự cấp thời hạn cho dữ liệu legacy. SL-033/034/035/036 dùng cùng entitlement có hạn khi triển khai, không khôi phục checksum offline.

Không thêm auto-renewal, invoice/refund/chargeback automation hoặc hứa xóa dữ liệu đúng thời điểm. Order receipt không tự purge trước khi retention/idempotency policy được duyệt.

## Sources

- [Spec](../superpowers/specs/2026-10-23-sl-031-032-payos-premium-design.md)
- [Plan](../superpowers/plans/2026-10-23-sl-031-032-payos-premium.md)
- https://payos.vn/docs/sdks/back-end/node/
- https://payos.vn/docs/api/
