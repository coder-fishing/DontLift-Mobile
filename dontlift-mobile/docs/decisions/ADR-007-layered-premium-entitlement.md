# ADR-007: Hai lớp Premium entitlement

## Status

Accepted

## Context

Activation code có thể được kiểm tra checksum khi offline, nhưng checksum embedded trong mobile app có thể bị reverse-engineer và không chứng minh code đã được mua hoặc chưa redeemed. Một số Premium benefits chỉ thay đổi hành vi local; quota, room capacity và shared leaderboard là server-authoritative.

## Decision

Premium entitlement có hai lớp độc lập:

1. **Local Premium** được mở ngay khi activation code vượt qua format và checksum validation. Local Premium chỉ mở:
   - ad-free UI;
   - permanent local `Violation Log` retention;
   - custom themes.
2. **Server Premium** chỉ được mở sau khi `redeemActivationCode` xác thực online, atomically redeem `activationCodes/{codeHash}` và đặt `users/{uid}.isPremium = true`. Server Premium mở:
   - unlimited room capacity;
   - unlimited monthly room creation;
   - advanced Penalty Leaderboard.

SQLite lưu riêng `local_premium` và `server_premium`. Full pending code được giữ tạm trong Expo SecureStore; SQLite chỉ giữ hash và verification status. Sau successful online redemption, app đặt cả hai flags, xóa pending code khỏi SecureStore và coi Firestore `isPremium` là authority cho server rights.

Checksum không bao giờ cấp server quota hoặc capacity. Nếu online redemption trả `already-exists`, `permission-denied` hoặc invalid code, app thu hồi server state nhưng giữ Local Premium chỉ khi checksum vẫn hợp lệ; UI phải chỉ rõ server benefits chưa được verified.

## Consequences

### Positive

- Offline activation vẫn mở ngay các benefits không gây server privilege escalation.
- Reverse-engineered checksum không thể bypass room quota hoặc capacity.
- Local retention và themes không phụ thuộc mạng.
- Server authority cho shared features còn một nguồn duy nhất.

### Negative

- UI phải biểu diễn hai entitlement states thay vì một boolean duy nhất.
- User có thể thấy Local Premium active trong khi server benefits còn chờ mạng.
- Failed redemption cần thông báo rõ mà không xóa local history đã được giữ trong lúc offline.

## Alternatives considered

### Checksum cấp toàn bộ Premium

Loại vì client-controlled proof không đủ authority cho server quota, capacity hoặc shared leaderboard.

### Bắt buộc online cho mọi Premium benefit

Loại vì vi phạm yêu cầu offline activation đối với ad-free, retention và custom themes.

## Source

- PRD US-19, OQ-6 và FR-06.
- Feature Spec Sections 4.4, 5.3 và 6.1.
- Human decision F-05 ngày 2026-09-23.
