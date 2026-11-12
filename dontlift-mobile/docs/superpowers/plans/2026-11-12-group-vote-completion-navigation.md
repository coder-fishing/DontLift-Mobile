# Kết thúc Group Session bằng vote và điều hướng Summary — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use the qskill-executing-plans skill to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
> Kế hoạch mô tả hành vi cần đạt, các file liên quan và cách xác nhận; người thực thi phải đọc lại mã hiện tại trước khi sửa.

**Goal:** Khi vote kết thúc phiên đạt đồng thuận, mọi thành viên chuyển vào Group Summary để sync và hoàn tất đối soát như luồng kết thúc phiên bình thường.

**Architecture:** Giữ vote và ballot như hiện tại, nhưng đổi chuyển trạng thái room ở transaction kết thúc vote thành `COMPLETED` với reconciliation `PENDING`. Firestore Rules xác nhận ballot cuối, vote đóng và room completion xảy ra nguyên tử. Mỗi client điều hướng sang Summary ngay khi nhận terminal snapshot hợp lệ; cập nhật SQLite là projection cục bộ không được chặn điều hướng.

**Tech Stack:** React Native, TypeScript, Firebase JS SDK, Cloud Firestore Security Rules, SQLite.

**Spec:** none (bounded task) — sửa luồng vote kết thúc phiên đã có để dùng quy trình sync/finalize hiện hành; giữ `CANCELLED` cho room bị hủy trước khi bắt đầu.

**Plan slug:** `2026-11-12-group-vote-completion-navigation` — mọi commit của plan bắt đầu bằng `[2026-11-12-group-vote-completion-navigation]`.

## Ràng buộc chung

- Không thêm dependency, Cloud Function hoặc thay đổi cấu trúc dữ liệu ngoài các marker completion/reconciliation đang được `room-completion-repository` sử dụng.
- Ballot cuối và trạng thái room phải được xác nhận trong cùng Firestore transaction.
- Kết quả vote đồng thuận phải giữ `reconciliationStatus: PENDING` cho tới khi tất cả thành viên sync hoặc Host dùng luồng override hiện có.
- Không để lỗi ghi projection SQLite cục bộ giữ thành viên ở màn hình Group Active sau khi server đã xác nhận room `COMPLETED`.
- Vote hết hạn hoặc không nhất trí không kết thúc phiên; chỉ Host override hoặc sync đầy đủ mới finalize theo quy tắc hiện có.

---

## File và trách nhiệm

- Sửa `dontlift-mobile/src/features/rooms/termination-vote-repository.ts` để ballot Yes cuối tạo trạng thái completion/reconciliation thống nhất với kết thúc room thông thường.
- Sửa `dontlift-mobile/firestore.rules` để chỉ cho phép giao dịch ballot nhất trí hợp lệ đồng thời chuyển room từ `ACTIVE` sang `COMPLETED`; cập nhật nhánh early-exit làm mẫu số vote thay đổi.
- Sửa `dontlift-mobile/src/app/index.tsx` để Summary hiển thị ngay từ snapshot `COMPLETED`, còn lỗi local projection không chặn điều hướng hoặc lặp lại thao tác kết thúc.
- Sửa `dontlift-mobile/src/screens/GroupActiveScreen.tsx` để không còn thông báo rằng unanimous vote đã hủy room.
- Cập nhật `dontlift-mobile/docs/decisions/ADR-016-spark-termination-vote.md` để ghi rõ quyết định mới thay cho semantics room `CANCELLED` đã được phê duyệt trước đó.
- Bổ sung test cho repository vote, Firestore Rules và điều hướng terminal snapshot trong các test tương ứng dưới `dontlift-mobile/__tests__/`.

## Task 1: Chuyển vote đồng thuận sang room completion

**Files:** `termination-vote-repository.ts`, `firestore.rules`, test repository/rules tương ứng.

- [ ] Thêm các case xác nhận ballot Yes cuối đóng vote nhưng chuyển room sang `COMPLETED`, đặt reconciliation ở `PENDING`, pending count bằng roster đã chốt, và khởi tạo các marker completion/ACK/finalization giống luồng completion thông thường.
- [ ] Xác nhận vote No hoặc chưa đủ Yes chỉ cập nhật ballot/count; room vẫn `ACTIVE`.
- [ ] Xác nhận người không thuộc roster, ballot lặp, vote hết hạn và transaction thiếu một trong các ghi liên quan đều bị từ chối.
- [ ] Cập nhật transaction vote để dùng `requestId` của ballot cuối làm completion request marker hợp lệ; giữ tính replay-safe cho ballot đã commit.
- [ ] Cập nhật Rules để liên kết ballot mới của người gọi, vote đóng với đủ Yes, và room `COMPLETED/PENDING` trong cùng commit; không mở rộng quyền tự hoàn tất room cho member khác.
- [ ] Khi Host duyệt early-exit làm vote trở thành nhất trí, chuyển room sang cùng trạng thái `COMPLETED/PENDING`; giữ member early-exit trong roster và pending count theo participant roster đã chốt.
- [ ] Chạy test repository và Firestore Rules liên quan.
- [ ] Commit task với subject `[2026-11-12-group-vote-completion-navigation] ...` và trailer `Plan` / `Task: 1`.

## Task 2: Điều hướng mọi client sang Group Summary an toàn

**Files:** `dontlift-mobile/src/app/index.tsx`, test điều hướng tương ứng.

- [ ] Thêm case terminal snapshot `COMPLETED` nhận bởi Host và member đang ở Group Active -> Group Summary hiển thị cho cả hai.
- [ ] Thêm case local SQLite projection lỗi hoặc database locked sau khi server đã xác nhận completion -> màn hình vẫn ở Group Summary và snapshot Firebase hiển thị được.
- [ ] Thêm case lỗi đồng bộ local không làm lặp việc chốt violation, xóa room state hoặc hiện cảnh báo như thể Firestore completion thất bại.
- [ ] Điều hướng sang Summary ngay khi nhận snapshot room `COMPLETED` hợp lệ; thực hiện reconciliation/local persistence ở nền và giữ retry/error handling cục bộ tách khỏi trạng thái server.
- [ ] Giữ nguyên điều hướng lobby cho room `CANCELLED` trước khi start, và các nhánh `ABORTED`/cancellation khác theo semantics hiện tại.
- [ ] Chạy test điều hướng Group Active/Summary.
- [ ] Commit task với subject `[2026-11-12-group-vote-completion-navigation] ...` và trailer `Plan` / `Task: 2`.

## Task 3: Đồng bộ thông điệp và quyết định kiến trúc

**Files:** `dontlift-mobile/src/screens/GroupActiveScreen.tsx`, `dontlift-mobile/docs/decisions/ADR-016-spark-termination-vote.md`, test màn hình nếu cần.

- [ ] Thay nội dung “This room was cancelled by unanimous vote.” bằng trạng thái vote đã kết thúc/phiên đang chuyển sang summary; không gọi room hoàn tất là đã hủy.
- [ ] Xác nhận các thành viên không còn thấy Group Active sau khi room completion được phản ánh; Group Summary giữ nhãn reconciliation đang chờ sync.
- [ ] Ghi amendment vào ADR-016: vote nhất trí kết thúc room bằng `COMPLETED/PENDING`; room `CANCELLED` chỉ biểu thị hủy trước start; sync đầy đủ hoặc Host override mới mở khóa kết quả cuối.
- [ ] Chạy test màn hình liên quan.
- [ ] Commit task với subject `[2026-11-12-group-vote-completion-navigation] ...` và trailer `Plan` / `Task: 3`.

## Kiểm tra tích hợp

- [ ] Chạy `pnpm exec tsc --noEmit`.
- [ ] Chạy test repository vote, Firestore Rules, Group Active và Summary.
- [ ] Kiểm tra manual trên hai thiết bị/tài khoản: cả hai Yes trước deadline -> cùng thấy Summary; một thành viên sync -> pending count cập nhật; thành viên cuối sync -> `FINALIZED/ALL_SYNCED`.
- [ ] Kiểm tra riêng Host early-exit làm vote nhất trí, vote No, hết hạn, mất mạng, và SQLite local projection lỗi; xác nhận không trường hợp nào báo room `CANCELLED` khi thực tế phiên đã hoàn tất.
- [ ] Ghi rõ nền tảng/thiết bị thực sự được kiểm tra; không tuyên bố PASS cho nền tảng chưa chạy.

## Quy tắc nghiệp vụ cần giữ

| Dữ liệu | Ý nghĩa sau thay đổi |
|---|---|
| Vote `status: CANCELLED` | Vote đóng vì đã đạt đồng thuận; không có nghĩa room đã bị hủy |
| Room `status: COMPLETED` | Phiên đã kết thúc và có thể vào Group Summary |
| Room `reconciliationStatus: PENDING` | Kết quả/bill còn chờ sync thành viên hoặc Host override |
| Room `status: CANCELLED` | Room bị hủy trước khi phiên bắt đầu |

