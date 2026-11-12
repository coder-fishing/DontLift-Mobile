# Review kế hoạch — Group Actionable Sessions

**Target:** [Plan](../plans/2026-11-12-group-actionable-sessions.md).
**Baseline:** Người dùng đã chọn mục “Needs attention” riêng phía trên và giữ lại 5 phiên Recent gần nhất.
**Nguồn đối chiếu:** Luồng Group Home, Group Active, Group Summary, Group History và trạng thái thanh toán hiện có trong repository.
**Phạm vi:** Chỉ sửa review report; không sửa plan, source code, tests hoặc Rules.

## GAS-001

- **Status:** OPEN
- **Severity:** High
- **Category:** Điều hướng phiên đang chạy
- **Location:** Task 2, Step 4 — “Resume an active room through the existing room restoration and active-session navigation.”
- **Problem:** Plan chưa nói rõ cách gắn room được chọn vào trạng thái room hiện hành của app trước khi mở Group Active. Hiện `GroupActiveScreen` chỉ nhận snapshot từ room hiện hành; mở màn hình khi chưa có snapshot sẽ hiện “Waiting for the active room snapshot…”. Hàng Recent hiện mở Group History, nên chỉ ghi “dùng luồng restoration hiện có” chưa đủ để bảo đảm nút Resume mở đúng phiên.
- **Recommendation:** Task 2 cần yêu cầu tải lại room và membership của mục được chọn, đưa room đó vào trạng thái app đang theo dõi rồi mới mở Group Active. Nếu room không còn ACTIVE, membership không hợp lệ, hoặc không lấy được snapshot, ở lại Group Home và đưa ra trạng thái phục hồi được thay vì mở màn hình Active rỗng. Thêm test cho đường đi Resume từ Group Home và các trường hợp room đã đổi trạng thái.
- **Created At:** 2026-11-12, review theo yêu cầu người dùng.
- **Updated By:** Codex.
- **Updated At:** 2026-11-12, Asia/Saigon.
- **Response:** Cần làm rõ trước khi plan được duyệt để implementation không chỉ đổi screen id mà thiếu dữ liệu room cho Group Active.

## GAS-002

- **Status:** OPEN
- **Severity:** High
- **Category:** Diễn giải trạng thái thanh toán
- **Location:** Task 1, Step 1 và Step 3; Task 2, Step 4.
- **Problem:** Plan dùng “Payment needs attention” cho share chưa được xác nhận, nhưng trạng thái hiện có chỉ phân biệt `UNPAID` và `MARKED_AS_PAID`; Host mới là người ghi nhận đã nhận tiền. App không thể biết một thành viên đã chuyển khoản bên ngoài hay chưa. Gắn nhãn như khoản chắc chắn chưa trả có thể khiến người đã chuyển tiền nhưng đang chờ Host xác nhận trả lần nữa.
- **Recommendation:** Dùng trạng thái có nghĩa chính xác là “chưa được xác nhận” và CTA “Review payment” cho share chưa có xác nhận. Chi tiết phải nhắc Host xác nhận sau khi nhận tiền; không khẳng định người dùng chưa chuyển khoản. Thêm test cho share vẫn `UNPAID` sau khi người dùng đã chuyển tiền nhưng Host chưa xác nhận.
- **Created At:** 2026-11-12, review theo yêu cầu người dùng.
- **Updated By:** Codex.
- **Updated At:** 2026-11-12, Asia/Saigon.
- **Response:** Trạng thái thanh toán phải phản ánh dữ liệu app biết được, không suy đoán giao dịch ngân hàng bên ngoài.

## GAS-003

- **Status:** OPEN
- **Severity:** High
- **Category:** Hành động xác nhận thanh toán của Host
- **Location:** Goal; Task 1, Step 1 và Step 3; Task 2, Step 4.
- **Problem:** Goal bao gồm việc Host còn bill/payment action, nhưng các trạng thái cụ thể chỉ nêu Host thiết lập bill và thành viên xem share của chính mình. Không có mục hoặc điều hướng để Host rà soát/xác nhận các khoản thành viên đã chuyển nhưng chưa được Host ghi nhận. Vì vậy một phần công việc thanh toán còn dang dở có thể không xuất hiện trong mục mới.
- **Recommendation:** Thêm trạng thái Host cần rà soát bill khi còn share chưa được xác nhận, mở màn bill allocation hiện có để Host xác minh và ghi nhận từng khoản. Không tự đánh dấu đã trả từ việc mở mục này. Thêm test cho Host có bill đã phát hành và còn share chưa xác nhận; thành viên vẫn chỉ thấy trạng thái của share của chính họ.
- **Created At:** 2026-11-12, review theo yêu cầu người dùng.
- **Updated By:** Codex.
- **Updated At:** 2026-11-12, Asia/Saigon.
- **Response:** Thiếu nhánh Host khiến mục “Needs attention” chưa bao phủ đầy đủ tác vụ thanh toán được nêu trong Goal.

## GAS-004

- **Status:** OPEN
- **Severity:** Medium
- **Category:** Thời hạn tồn tại của tác vụ chưa hoàn tất
- **Location:** Architecture; Global Constraints; Task 1, Step 3.
- **Problem:** Plan không quy định một phiên chưa xử lý bill/thanh toán có còn xuất hiện sau thời hạn lịch sử thông thường hay không. Luồng History hiện giới hạn truy vấn room index cho tài khoản không Premium theo cửa sổ 7 ngày. Nếu action queue tái sử dụng bộ lọc này, khoản chưa giải quyết sau 7 ngày có thể biến mất dù vẫn cần xử lý.
- **Recommendation:** Nêu rõ action chưa hoàn tất có được giữ độc lập với giới hạn lịch sử 7 ngày hay không. Nếu có, yêu cầu các tác vụ còn mở vẫn được tìm thấy sau mốc này và thêm test cho người dùng không Premium với bill chưa thanh toán đã quá 7 ngày. Nếu không, ghi rõ giới hạn đó là quyết định sản phẩm để người dùng không hiểu mục này liệt kê mọi khoản còn tồn.
- **Created At:** 2026-11-12, review theo yêu cầu người dùng.
- **Updated By:** Codex.
- **Updated At:** 2026-11-12, Asia/Saigon.
- **Response:** Chưa có quyết định trong baseline về thời hạn giữ các tác vụ đang mở; không nên tự suy ra từ chính sách xem lịch sử.

## GAS-005

- **Status:** OPEN
- **Severity:** Medium
- **Category:** Ngân sách đọc dữ liệu
- **Location:** Architecture; Task 1, Step 3.
- **Problem:** “Các room đã biết” có thể tăng theo thời gian, nhưng plan không đặt giới hạn số room/bill cần đọc, không mô tả tải tăng dần hoặc hành vi khi có nhiều room. Việc đọc trạng thái và bill của từng room mỗi lần mở Group Home có thể làm chậm màn hình và tăng số lần đọc Firebase.
- **Recommendation:** Bổ sung quy tắc tải có giới hạn hoặc tăng dần, cách ưu tiên room còn mở, và cách dùng cache khi offline. Thêm test với nhiều room đã biết để đảm bảo Group Home vẫn render các nội dung chính trong khi danh sách tác vụ được tải.
- **Created At:** 2026-11-12, review theo yêu cầu người dùng.
- **Updated By:** Codex.
- **Updated At:** 2026-11-12, Asia/Saigon.
- **Response:** Plan cần đặt kỳ vọng tải trước khi implementation tạo truy vấn theo từng room không giới hạn.

## GAS-006

- **Status:** OPEN
- **Severity:** Low
- **Category:** Lệnh kiểm tra trong plan
- **Location:** Task 1, Steps 2 và 4; Task 2, Steps 2 và 5; Task 3, Step 1.
- **Problem:** Các bước yêu cầu chạy “focused repository tests”, “focused dashboard and navigation tests”, hoặc “relevant … tests” nhưng không ghi lệnh cụ thể. Plan vì thế chưa hoàn toàn tự đủ để người thực hiện chạy lại đúng nhóm kiểm tra.
- **Recommendation:** Ghi các lệnh `pnpm test -- --runInBand` cụ thể cho những file test có sẵn và tên file dự kiến cho test mới; giữ riêng lệnh TypeScript và `git diff --check` đã có ở Task 3.
- **Created At:** 2026-11-12, review theo yêu cầu người dùng.
- **Updated By:** Codex.
- **Updated At:** 2026-11-12, Asia/Saigon.
- **Response:** Một số bước kiểm tra đã nêu kết quả kỳ vọng nhưng thiếu command; bổ sung command không đòi hỏi thay đổi scope sản phẩm.

## Tự kiểm tra report

- Đã đối chiếu toàn bộ plan với lựa chọn đã duyệt: mục “Needs attention” riêng và giữ 5 Recent.
- Các Issue ID là duy nhất; mỗi finding có trạng thái, severity, vị trí, vấn đề, đề xuất và response.
- `review` mode chỉ tạo report; plan và source code không bị sửa.
