# ADR-004: Firestore ownership bằng membership documents và deny-by-default Rules

## Status

Accepted

## Context

DontLift có hai room roles: Host và Member. Feature Spec mô tả Member access qua `participantIds`, nhưng premium rooms không có product-level participant cap. Một array trên room document làm tăng contention, nhân đôi membership data và bị giới hạn bởi document size.

Security phải chống create/update inconsistency, role escalation, field mutation, resource abuse và cross-room access.

## Decision

Membership authority là document:

`rooms/{roomId}/members/{uid}`

Rules dùng authenticated UID và membership existence:

- Default deny.
- User chỉ đọc profile của mình và chỉ sửa profile field allowlist.
- `isPremium`, role, score, room status, counters và bill fields là server-owned.
- Host/Member chỉ đọc room resources khi membership hợp lệ.
- Client không trực tiếp ghi authoritative room subcollections.
- `roomPins`, monthly usage, activation codes và sync receipts bị deny hoàn toàn với client.
- Create/update đều kiểm tra field allowlist, types, size và immutable fields.
- Queries phải mang constraints tương thích với Rules.

Functions dùng Admin SDK phải lặp lại Auth, role, ownership, type, size và lifecycle checks vì Admin SDK bỏ qua Rules.

PIN được reserve bằng `roomPins/{pin}` trong transaction. Client join qua `joinRoomByPin`; không query PIN collection.

## Consequences

### Positive

- Không có unbounded participant array trên room.
- Role authority không đến từ request payload.
- Membership document phục vụ Rules và domain cùng lúc.
- Server-only collections không bị client enumeration.
- Dễ audit field ownership và create/update parity.

### Negative

- Rules dùng `exists()` có billed reads và access-call limits.
- Query design phải khớp authorization model.
- Functions authorization code là bắt buộc và phải được test riêng.
- Premium “unlimited” vẫn chịu service, cost và UI scalability limits.

## Alternatives considered

### `participantIds` array trên room

Loại vì contention, duplicated state, document growth và mismatch với no product-level cap.

### Role do client gửi

Loại vì privilege escalation risk.

### Chỉ bảo vệ bằng UI conditional rendering

Loại vì UI không phải security boundary.

## Source

- Feature Spec Section 2 RBAC, Section 3 lifecycle và Section 6 data model.
- PRD US-06 đến US-12, FR-03 và FR-04.
- Decision Packet F-06 về Host controls không được render cho Member.
