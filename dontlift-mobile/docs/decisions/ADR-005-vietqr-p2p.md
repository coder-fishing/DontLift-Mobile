# ADR-005: VietQR P2P non-custodial settlement

## Status

Accepted

## Context

DontLift phân bổ bill dựa trên authoritative Penalty Scores. Product cấm wallet, escrow, payment gateway custody và automatic bank verification. Member cần thanh toán trực tiếp cho Host bằng Vietnamese banking app.

## Decision

- Cloud Functions tính authoritative bill shares bằng integer VND sau score reconciliation.
- `totalBillVnd` phải chia hết cho 1.000 để vừa bảo đảm rounded shares vừa bảo đảm tổng tuyệt đối.
- Tỷ trọng 40/60 dùng integer basis points `4000/6000`, không dùng floating point.
- Sau override, phần còn lại dùng cùng penalty formula cho mọi non-overridden Members.
- Early Exit Member dùng score đã đóng băng.
- Client tạo VietQR từ authoritative `shareVnd`, Host bank details và memo `DL [RoomCode] [MemberName]`.
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
- Total bill phải được Host nhập theo bội 1.000 VND.
- Member phải rời hoặc chuyển sang banking app để thanh toán.

## Alternatives considered

### In-app wallet/payment gateway

Bị loại bởi strict product exclusions.

### Automatic bank verification

Bị loại bởi strict product exclusions và yêu cầu bank integration mới.

### Cho phép total bill không chia hết 1.000

Loại vì không thể đồng thời bảo đảm mọi share làm tròn 1.000 và tổng shares bằng chính xác total bill.

## Source

- PRD OQ-1, OQ-2, FR-05, Section 8 và strict exclusions.
- Feature Spec Sections 4.3 và 5.2.
