# Thiết kế SL-031/032 — Mua Premium qua payOS

**Trạng thái:** Thiết kế được duyệt trong hội thoại ngày 2026-10-23; đang chờ user rà bản spec này trước khi lập implementation plan.
**Nhánh thiết kế:** `feature/sl-031-032-payos-premium` từ `origin/main`.
**Phạm vi:** Thay luồng activation/redeem bằng một gói Premium online có thời hạn, payOS checkout và một Express backend nhỏ. Firestore tiếp tục ở Firebase Spark.

## 1. Mục tiêu

DontLift có một loại quyền Premium. Người dùng chọn gói thời hạn, thanh toán qua payOS, và chỉ nhận quyền sau khi backend xác minh giao dịch. Không có tự gia hạn, mã kích hoạt offline, Local Premium riêng, Casso, MongoDB hoặc MySQL.

Giá và thời hạn được duyệt:

| Gói | Tháng tính phí | Tháng được cấp | Giá |
|---|---:|---:|---:|
| 1 tháng | 1 | 1 | 89.000 VND |
| 3 tháng | 2 | 3 | 178.000 VND |
| 6 tháng | 4 | 6 | 356.000 VND |
| 12 tháng | 7 | 12 | 623.000 VND |

Thời hạn dùng tháng lịch. Khi gia hạn, tháng được cấp nối từ thời điểm muộn hơn giữa hiện tại và hạn Premium đang có. Cộng tháng lịch giữ ngày trong tháng nếu hợp lệ; nếu tháng đích ngắn hơn, dùng ngày cuối tháng đích. Lưu thời điểm hết hạn UTC trong Firestore; quy tắc tính lịch dựa trên giờ Việt Nam `Asia/Ho_Chi_Minh`.

## 2. Luồng người dùng và dữ liệu

1. Người dùng đang đăng nhập mở trang Premium và chọn một gói. Mạng phải khả dụng để bắt đầu checkout.
2. App gửi package ID và Firebase ID token tới Express. App không gửi số tiền được tin cậy; backend lấy giá và số tháng từ bảng gói cố định phía server.
3. Express xác minh Firebase ID token, tạo mã đơn duy nhất, lưu đơn `PENDING` trong Firestore và gọi payOS tạo payment link. Backend trả checkout URL và mã đơn cho app.
4. App mở checkout URL bằng browser hệ thống. `returnUrl`/`cancelUrl` chỉ đưa người dùng trở lại app; kết quả redirect không tự cấp quyền.
5. payOS gửi webhook tới HTTPS endpoint của Express. Express xác minh chữ ký, đối chiếu mã đơn, số tiền, currency và trạng thái với đơn server đã lưu.
6. Một Firestore transaction đánh dấu đơn đã trả và gia hạn Premium đúng một lần. Webhook trùng được xác nhận idempotently, không cộng thời hạn lần nữa.
7. App đọc trạng thái đơn từ Express/Firestore. Nếu webhook đến trễ, giao diện giữ trạng thái đang xác minh và cho thử làm mới; không báo thành công chỉ vì checkout quay về.

Đơn lưu tối thiểu `orderCode`, `uid`, `packageId`, `amountVnd`, `paidMonths`, `grantedMonths`, `status`, thời điểm tạo và thông tin payment-link cần đối chiếu. Không lưu dữ liệu thẻ/tài khoản ngân hàng hoặc bí mật payOS trong app.

## 3. Kiến trúc và authority

- **Mobile app:** Hiển thị bốn lựa chọn gói, trạng thái checkout, đang chờ xác nhận, thành công, hủy và lỗi/retry. Chỉ lấy giá từ dữ liệu/package contract; backend vẫn tự áp giá chuẩn.
- **Express API:** Hai trách nhiệm bên ngoài Firebase Functions: xác thực user, tạo đơn/link và nhận/kiểm tra webhook. Firebase Admin SDK ghi Firestore bằng credential phía server.
- **Firestore:** Vẫn là database hiện tại trên Spark. `premiumExpiresAt` là mốc hết hạn có authority; Rules kiểm tra mốc này bằng `request.time` cho mọi quyền server Premium. Trường `isPremium` cũ không được dùng một mình làm bằng chứng quyền còn hạn.
- **payOS:** Tạo payment link và gửi webhook đã ký. Xác minh webhook theo tài liệu payOS; không tin callback query của browser.
- **Không thêm database:** Đơn hàng và entitlement lưu trong Firestore, tránh đồng bộ hai nguồn dữ liệu.

Admin SDK bỏ qua Firestore Security Rules. Vì vậy Express phải xác minh Firebase ID token ở mọi endpoint của người dùng, kiểm tra ownership của order, giới hạn package/amount theo cấu hình server, và chỉ webhook hợp lệ mới được ghi nhận thanh toán. Credential Admin và payOS chỉ nằm trong secret store của backend.

## 4. Thay đổi so với hợp đồng hiện tại

ADR-007 và các plan SL-031/032 hiện mô tả Local Premium không thời hạn qua checksum cùng Server Premium qua mã redeem. Thiết kế này thay mô hình đó bằng một entitlement duy nhất có hạn; implementation plan sẽ sửa ADR-007, API contract, profile/entitlement projection, Firestore Rules và quyền lợi Premium để dùng `premiumExpiresAt`.

Local cache có thể giữ bản chiếu thời hạn cuối cùng đã biết để hiển thị khi offline; cache không thể cấp quyền server. Quyền tăng quota/capacity/leaderboard được Firestore Rules xác minh theo thời gian server. Các quyền local chỉ dùng cache cho hiển thị và không làm thay đổi authority server.

SL-033 phải được cập nhật sau hoặc cùng đợt: retention dựa trên một entitlement có hạn, không còn phân biệt Local Premium với Server Premium. D10 về bảo vệ pending/failed data và thời hạn receipt vẫn cần quyết định riêng.

## 5. Triển khai và giới hạn free tier

Express chạy trên một host riêng, có URL HTTPS công khai để payOS gọi webhook. Firebase project vẫn Spark; không triển khai Cloud Functions, không liên kết billing account Firebase. Host Express là dịch vụ riêng, gói miễn phí, giới hạn, thời gian ngủ và mức sẵn sàng phải được xác minh với nhà cung cấp trước khi chọn. Không tuyên bố miễn phí hoặc luôn sẵn sàng nếu chưa xác nhận điều khoản host.

payOS cần `Client ID`, `API Key` và `Checksum Key` cho channel, không chỉ một API key. Cần thêm Firebase Admin credential/project identity và cấu hình URL webhook/return/cancel của host. Không commit các giá trị này. Có thể hoàn tất source, UI, tests và cấu hình mẫu trước; kết nối live chỉ chạy sau khi user cấp đủ credentials và host URL.

## 6. Failure, replay và nghiệm thu

- Token thiếu/hết hạn hoặc UID không khớp: từ chối tạo đơn/status.
- Package ID không hợp lệ: từ chối; amount lấy server-side, không nhận amount từ app.
- payOS timeout/không tạo được link: order không được ghi thành đã trả; app có thể retry với order mới theo contract.
- Webhook sai chữ ký, sai amount, unknown order hoặc payment chưa hoàn tất: không cấp Premium.
- Webhook bị gửi nhiều lần hoặc hai callback đua nhau: chỉ một transaction gia hạn hạn Premium.
- Hai đơn hợp lệ đồng thời: cả hai tháng được cộng nối, không ghi đè gia hạn đã commit.
- App bị kill sau khi trả tiền: khi mở lại, đọc đơn/entitlement từ server và phản ánh trạng thái đã commit.
- Hết hạn: UI hiển thị Free theo mốc đã biết; Rules từ chối server benefits từ thời điểm `request.time >= premiumExpiresAt`, không cần scheduled job để khóa quyền.
- Không có live test với payOS nếu thiếu merchant channel/keys; phải dùng mock/contract tests và test webhook chữ ký trước.

## 7. Ngoài phạm vi

Tự gia hạn subscription, nhiều tier Premium, phát hành mã activation, tích hợp Casso, invoice/tax, hoàn tiền tự động, admin dashboard, chargeback workflow, build/deploy production, và bất kỳ việc bật Firebase Blaze/billing nào.

## 8. Tài liệu tham chiếu

- [ADR-007 hiện tại](../../decisions/ADR-007-layered-premium-entitlement.md)
- [Plan SL-031 hiện tại](../plans/2026-10-13-sl-031-local-premium.md)
- [Plan SL-032 hiện tại](../plans/2026-10-13-sl-032-server-premium.md)
- [payOS Node.js SDK](https://payos.vn/docs/sdks/back-end/node/)
- [payOS API và chữ ký payment link](https://payos.vn/docs/api/)
- [payOS webhook](https://payos.vn/docs/du-lieu-tra-ve/webhook/)
- [Firebase Spark/Blaze](https://firebase.google.com/docs/projects/billing/firebase-pricing-plans)
