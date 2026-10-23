# Review code — Premium payOS SL-031/032

Baseline: `docs/superpowers/plans/2026-10-23-sl-031-032-payos-premium.md`, đã được user duyệt ngày 2026-10-23. Target: Express API, Premium mobile journey, entitlement projection và Firestore Rules trong working tree từ `9588bad`.

Review ngày 2026-10-23, inline, không subagent. Đã đối chiếu identity/replay trước network, chữ ký SDK, transaction grant, expiry Rules, profile editing, account changes, receipt cũ và khôi phục checkout. Live merchant/thiết bị thật chưa xác minh khi thiếu credentials và host URL.

## PC-001

- Status: RESOLVED
- Severity: High
- Category: Entitlement integration
- Location: `src/screens/HistoryScreen.tsx:24`; `src/screens/GroupHistoryScreen.tsx:15`.
- Problem: Solo history hard-code localPremium false và group history mặc định localPremium false dù serverPremium active. Vì hai màn vẫn chia cờ cũ, user đã trả tiền chỉ được mở cloud-origin history nhưng local-origin records quá bảy ngày vẫn bị lọc. Điều này lệch một entitlement thống nhất trong ADR-025 và Task 5 inventory consumers.
- Recommendation: Các history UI contexts phải lấy cả hai origin flags từ cùng trạng thái Premium còn hạn; không cấp một Local Premium độc lập. Giữ purge/retention D10 ngoài scope. Kiểm tra hai màn thực sự truyền cùng flag và expiry trở lại Free.
- Created At: 2026-10-23
- Updated By: Codex
- Updated At: 2026-10-23
- Response: Đã xác nhận lỗi và đồng bộ localPremium/serverPremium từ cùng trạng thái có hạn trong hai screen. Loại prop localPremium độc lập khỏi GroupHistoryScreen. Tests hai màn kiểm tra context khi Premium active và khi về Free; không thay policy xóa dữ liệu D10.

## Kiểm tra report

Đã rà nguồn, vị trí, plan và độ nghiêm trọng; issue mô tả trường hợp thực tế trong inventory consumer, không yêu cầu triển khai purge SL-033. Không có finding độc lập khác được chứng minh trong lượt này.
