# ADR-005: VietQR P2P non-custodial settlement

## Status

Accepted

## Context

DontLift phân bổ bill dựa trên authoritative Penalty Scores. Product cấm wallet, escrow, payment gateway custody và automatic bank verification. Member cần thanh toán trực tiếp cho Host bằng Vietnamese banking app.

## Decision

- Cloud Functions tính authoritative bill shares bằng integer VND sau score reconciliation.
- `totalBillVnd` là positive integer tối thiểu 1.000 VND; không cần chia hết cho 1.000.
- Tỷ trọng 40/60 dùng integer basis points `4000/6000`, không dùng floating point.
- Default Hybrid Bill Allocation hoặc Host overrides đều tạo cùng raw share vector `P_i`; không có remainder-after-override branch riêng.
- Mỗi raw share được round tới 1.000 VND gần nhất bằng integer arithmetic; tie đúng 500 VND round lên mốc 1.000 kế tiếp. Server tính $\Delta = totalBillVnd - \sum roundedShares$.
- Khi $|\Delta| \ge 1.000$, server phân phối từng bước 1.000 VND theo residual rank: cộng từ residual cao xuống khi $\Delta > 0$, trừ từ residual thấp lên khi $\Delta < 0`; không được làm share âm.
- Nếu còn sub-1.000 VND residual, server áp dụng chính xác phần còn lại cho eligible Member đứng đầu cùng residual rank. Vì vậy tối đa một final share không chia hết cho 1.000.
- Tie được phá ổn định bằng Member UID tăng dần. Invariant cuối cùng là $\sum finalShares = totalBillVnd$ chính xác.
- Early Exit Member dùng score đã đóng băng.
- Client tạo VietQR từ authoritative `shareVnd`, room-scoped Host bank details và memo `DL [RoomCode] [MemberName]`.
- Host ghi `rooms/{roomId}/settlementDetails/current` chỉ qua `setSettlementDetails`; room Members có read access để tạo QR.
- Settlement details chứa bank ID, account number, account name, timestamps và `expiresAt = room.completedAt + 30 days`.
- Scheduled cleanup xóa settlement details khi hết hạn. Bank details không được ghi vào logs hoặc analytics.
- Payment xảy ra hoàn toàn ngoài DontLift.
- Chỉ Host có thể chuyển `UNPAID → MARKED_AS_PAID` sau khi tự kiểm tra bank notification.
- Không có bank API polling hoặc reverse transition tự động.

## Consequences

### Positive

- Giữ non-custodial guarantee.
- Không xử lý tiền hoặc bank credentials để thực hiện giao dịch.
- Bill math deterministic và kiểm thử được.
- VietQR không được tạo từ stale local preview.

### Negative

- Host confirmation có thể sai hoặc bị quên.
- Không có automatic reconciliation, dispute resolution hoặc payment proof.
- Khi bill không chia hết cho 1.000, tối đa một final share chứa sub-1.000 VND residual để giữ tổng chính xác.
- Member phải rời hoặc chuyển sang banking app để thanh toán.

## Alternatives considered

### In-app wallet/payment gateway

Bị loại bởi strict product exclusions.

### Automatic bank verification

Bị loại bởi strict product exclusions và yêu cầu bank integration mới.

### Bắt buộc total bill chia hết cho 1.000

Loại theo human decision F-07. Thay vào đó, một sub-1.000 VND residual cuối cùng được gán deterministically cho một eligible Member.

## Source

- PRD OQ-1, OQ-2, FR-05, Section 8 và strict exclusions.
- Feature Spec Sections 4.3 và 5.2.
- Human decision F-07 ngày 2026-09-23: một rounding pipeline cho default/override và exact sub-1.000 VND residual.
- Human decision F-08 ngày 2026-09-23: room-scoped settlement details với Host-only Function write và 30-day retention.
