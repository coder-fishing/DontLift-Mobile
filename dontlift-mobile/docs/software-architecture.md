# Kiến trúc phần mềm DontLift

> **Trạng thái:** APPROVED  
> **Ngày phê duyệt:** 2026-09-23
> **Phạm vi:** Expo SDK 57, Android/iOS, Firebase Authentication, Cloud Firestore, Cloud Functions, SQLite, VietQR P2P  
> **Nguồn:** `docs/project-context.md`, `docs/product-requirements.md`, `docs/feature-specification.md`, `design/concepts/concept-final/decision-packet.md`, P5.2 human decisions F-01–F-11

## 1. Mục tiêu và phạm vi

DontLift dùng kiến trúc mobile offline-first với Firebase làm backend authoritative cho dữ liệu chia sẻ. Kiến trúc phải bảo đảm:

1. `Solo Focus Mode` hoạt động đầy đủ khi không có mạng.
2. `Group Room Mode` yêu cầu mạng để create/join nhưng tiếp tục `Phone-Down Detection` và ghi `Violation Log` khi kết nối bị gián đoạn.
3. Mọi offline event được ghi SQLite trước khi đồng bộ, giao ít nhất một lần và tạo hiệu ứng backend idempotent.
4. Mobile client không có quyền authoritative đối với lifecycle, Penalty Score cuối cùng, quota, entitlement hoặc bill allocation.
5. `VietQR P2P` là non-custodial; DontLift không giữ tiền, không có ví và không xác minh ngân hàng tự động.

Không thuộc phạm vi: Kiosk Mode, In-App Wallet, In-App Chat, AI Assistant, camera detection, automatic bank verification và hạ tầng ngoài Expo + Firebase không được nêu trong tài liệu này.

## 2. Tổng quan kiến trúc

Sơ đồ hệ thống: [`design/system-context.mmd`](../design/system-context.mmd).

### 2.1 Mobile client

- **Presentation:** Expo Router screens, UI state và accessibility states.
- **Domain:** `Phone-Down Detection`, `3-Second Grace Period`, session controller, Penalty Score preview và VietQR payload construction.
- **Local persistence:** SQLite domain tables, room projection và durable `sync_outbox`.
- **Firebase adapters:** React Native Firebase Auth, Firestore realtime listeners và callable Cloud Functions.

### 2.2 Firebase

- **Firebase Authentication:** Email/Password identity cho MVP.
- **Cloud Firestore Standard:** Nguồn sự thật cho shared state.
- **Cloud Functions 2nd gen:** Command authorization, lifecycle transitions, quota, idempotent event ingestion, score finalization, bill calculation và entitlement redemption.
- **Scheduled Functions:** Dọn vote hết hạn, đánh dấu room `ABORTED`, purge free-tier Solo history và xóa expired settlement details.

### 2.3 External boundary

VietQR nhận payload hoặc image request để banking app xử lý thanh toán ngoài DontLift. DontLift chỉ lưu `UNPAID | MARKED_AS_PAID`, trong đó Host xác nhận thủ công.

## 3. Mobile component boundaries và state management

### 3.1 Domain boundaries

| Unit | Trách nhiệm | Không phụ thuộc |
|---|---|---|
| Sensor adapter | Đọc accelerometer/gyroscope và phát orientation sample | UI, Firebase |
| Phone-down engine | Chuyển sample thành `UNKNOWN | FACE_DOWN | INVALID | LIFTED` | UI, persistence |
| Grace-period engine | Xác nhận violation sau 3 giây | Firestore |
| Session controller | Timer, active session và local lifecycle | Screen implementation |
| Local repository | SQLite transactions và typed domain records | Firestore UI |
| Sync worker | Lease, batch, retry và acknowledgment | Sensor logic |
| Firebase gateway | Auth, listeners và callable Functions | Screen layout |
| Settlement service | VietQR payload từ authoritative bill share | Bank API |

Raw sensor streams không rời thiết bị.

### 3.2 State ownership

- SQLite là nguồn đọc local cho Solo sessions, local history, pending events và cached room projection.
- Firestore là nguồn sự thật cho Solo session summaries đã sync, room lifecycle, membership, shared violations, leaderboard, votes, bill shares và verified entitlement.
- Firestore native cache hỗ trợ listener recovery; nó không thay thế durable SQLite outbox.
- Auth controller và active-session controller giữ state sống trong memory.
- Không thêm global state/cache library trong kiến trúc nền. Repository subscription được dùng trước; thư viện state chỉ được thêm khi có nhu cầu đo được.

### 3.3 Reconciliation precedence

1. Firestore thắng đối với shared authoritative state.
2. Firestore snapshot không được xóa pending local event.
3. Pending event chỉ chuyển trạng thái khi backend trả kết quả cho chính `event_id` đó.
4. Screens không tự merge Firestore và SQLite; repository thực hiện merge tại một boundary duy nhất.

### 3.4 Platform lifecycle state transitions

Khi active session chuyển từ foreground sang `inactive` hoặc `background`:

1. Platform adapter atomically persist SQLite lifecycle candidate với UUID, session ID, transition UTC time, platform monotonic marker và `PENDING` trước khi callback kết thúc.
2. Grace-period engine bắt đầu tại transition time. Candidate chưa phải confirmed `Violation Log`.
3. Foreground trở lại trước 3 giây hủy candidate và không ghi violation.
4. Condition kéo dài ít nhất 3 giây tạo `Violation Log` và matching `sync_outbox` event trong một transaction; candidate UUID được reuse để confirmation idempotent.
5. Nếu OS suspend hoặc kill process, startup/resume reconciliation dùng monotonic marker khi còn hợp lệ, fallback UTC với clock-anomaly guard, rồi cancel hoặc confirm theo cùng mốc 3 giây.

Trên iOS, adapter gọi native `beginBackgroundTaskWithExpirationHandler` sau durable candidate commit, monitor `backgroundTimeRemaining`, và luôn gọi `endBackgroundTask` sau cancel, confirmation hoặc expiration handling. Expiration chỉ persist unresolved state; network sync không được giả định hoàn tất trước suspend.

Trên Android, lifecycle observer persist candidate tại `ON_STOP`; WorkManager chỉ làm deferred reconciliation/sync và không được coi là exact 3-second timer. Sensor polling dừng khi OS suspend. Chi tiết nằm trong ADR-008.

## 4. Authentication và token management

### 4.1 Flow

1. User đăng ký hoặc đăng nhập bằng Firebase Auth Email/Password.
2. Native Firebase SDK quản lý ID token, refresh token và auth-state persistence.
3. Callable requests tự gắn Firebase ID token.
4. App quan sát auth state; không đọc hoặc sao chép refresh token.
5. Sign-out hủy Firestore listeners, đóng user-scoped repositories và xóa native auth state qua Firebase SDK.

### 4.2 Local token security

- Không lưu token vào SQLite hoặc AsyncStorage.
- Không tạo bản sao token trong Expo SecureStore; native Firebase Auth là chủ sở hữu duy nhất của token lifecycle.
- Expo SecureStore giữ pending activation code trong thời gian chờ online redemption; SQLite chỉ giữ code hash và verification state. SecureStore không giữ Firebase token.
- Error log và analytics không chứa token, email đầy đủ, activation code đầy đủ hoặc bank account.

Đây là human-approved exception của Feature Spec Section 1.1 theo F-06 ngày 2026-09-23. Native Firebase Auth persistence là secure storage boundary; app không đọc, export hoặc sao chép refresh token. Quyết định giữ một token lifecycle owner và vẫn đáp ứng PRD token-security outcome.

## 5. Ownership và authorization

### 5.1 Resource ownership

| Resource | Read | Write authority |
|---|---|---|
| `users/{uid}` | Chính user | User chỉ sửa profile allowlist; Functions sửa entitlement |
| `users/{uid}/sessions/{sessionId}` | Chính user | `syncEvents` Function |
| `rooms/{roomId}` | Host hoặc Member có membership | Functions |
| `members/{uid}` | Thành viên room | Functions |
| `violations/{eventId}` | Thành viên room | `syncEvents` Function |
| early-exit requests | Thành viên room | Request/decision Functions |
| termination votes | Thành viên room | Vote Functions |
| `billShares/{uid}` | Thành viên room | Settlement Functions |
| `settlementDetails/current` | Thành viên room | `setSettlementDetails` Host-only Function |
| PIN, usage, activation, receipts | Không client nào | Functions |

### 5.2 Security Rules principles

- Deny by default.
- Membership authority là `rooms/{roomId}/members/{uid}`; không dùng unbounded `participantIds` array.
- User không thể sửa `isPremium`, role, score, room status, count, bill hoặc payment state trực tiếp.
- Create và update đều kiểm tra field allowlist, types, size và immutability.
- Query phải chứng minh cùng điều kiện mà Rules yêu cầu vì Rules không phải bộ lọc.
- Admin SDK bỏ qua Rules, do đó mọi Function phải tự kiểm tra Auth, role, ownership, schema và current lifecycle state.

## 6. Data model

Sơ đồ dữ liệu: [`design/data-model.mmd`](../design/data-model.mmd).

### 6.1 Firestore collections

#### `users/{uid}`

| Field | Type | Authority |
|---|---|---|
| `displayName` | string | User allowlisted update |
| `isPremium` | boolean | Verified Server Premium; Functions only |
| `createdAt`, `updatedAt` | timestamp | Functions |

Email tiếp tục thuộc Firebase Auth và không được sao chép sang Firestore nếu không có use case cần đọc.

#### `users/{uid}/sessions/{sessionId}`

`sessionId` là UUID do client tạo và đồng thời là idempotency key cho `SOLO_SESSION_COMPLETED`. Document chứa `durationSeconds`, `liftCount`, `violationDurationSeconds`, `penaltyScore`, `startedAt` và `completedAt`. Chỉ owner `uid` được đọc; client không ghi trực tiếp.

History query của US-16 đọc collection này theo owner path, sắp xếp `completedAt DESC`, dùng cursor pagination và merge qua repository với SQLite history. Free user chỉ nhận sessions có `completedAt` trong 7 ngày gần nhất; Scheduled Function purge document hết retention. Premium user giữ permanent history. Entitlement dùng tại thời điểm purge là verified server entitlement; local checksum không ngăn server purge.


#### `rooms/{roomId}`

| Field | Type | Meaning |
|---|---|---|
| `hostId` | string | Host Firebase UID |
| `pin` | string | Four-digit display PIN |
| `status` | enum | `CREATED | WAITING | ACTIVE | COMPLETED | CANCELLED | ABORTED` |
| `participantCount` | integer | Server-maintained aggregate |
| `hostHeartbeatAt` | timestamp | Host liveness |
| `createdAt`, `startedAt`, `endedAt`, `updatedAt` | timestamp/null | Lifecycle timestamps |
| `totalBillVnd` | integer/null | Positive integer tối thiểu 1.000 |
| `reconciliationStatus` | enum | `PENDING | FINALIZED` sau completion |
| `pendingMemberCount` | integer | Server-maintained completion reconciliation count |
| `finalizedAt`, `finalizedBy` | timestamp/string/null | Score finalization audit |
| `finalizationReason` | enum/null | `ALL_SYNCED | HOST_OVERRIDE` |

#### `rooms/{roomId}/members/{uid}`

`displayName`, `role`, `status`, `liftCount`, `violationDurationSeconds`, `penaltyScore`, `joinedAt`, `earlyExitAt`, `syncedThroughAt`, `syncAcknowledgedAt`.

#### `rooms/{roomId}/violations/{eventId}`

`userId`, `startedAt`, `endedAt`, `durationSeconds`, `receivedAt`, `excludedFromFinalScore`, `exclusionReason`.

#### Other room subcollections

- `earlyExitRequests/{requestId}`
- `terminationVotes/{voteId}`
- `terminationVotes/{voteId}/ballots/{uid}`
- `billShares/{uid}`
- `reconciliationAudits/{auditId}`
- `settlementDetails/current`

A bill share stores `baseShareVnd`, `penaltyShareVnd`, optional override information, `shareVnd`, `paymentStatus` và `updatedAt`. `settlementDetails/current` stores `bankId`, `accountNumber`, `accountName`, `updatedAt` và `expiresAt = room.completedAt + 30 days`; only `setSettlementDetails` writes it, room Members may read it, and scheduled cleanup deletes it at expiry. Bank details never enter logs or analytics. A `reconciliationAudits` document is append-only and stores `action = HOST_OVERRIDE`, `actorUid`, `requestId`, `unsyncedMemberUids`, `roomEndedAt`, `createdAt` và resulting score snapshot reference.

### 6.2 Server-only supporting collections

- `roomPins/{pin}`: unique active PIN reservation and room reference.
- `users/{uid}/usage/{yyyyMM}`: atomic room-creation counter.
- `activationCodes/{codeHash}`: redemption authority; plaintext code không làm document ID.
- `users/{uid}/syncReceipts/{eventId}`: event type, payload hash, outcome, processed time và optional destination reference.

Receipts được giữ lâu hơn maximum local retry/retention window rồi dọn bằng Firestore TTL. Xóa receipt không xóa domain record.

### 6.3 SQLite tables

- `sessions`
- `rooms`
- `room_members`
- `violation_logs`
- `entitlements`
- `app_settings`
- `sync_outbox`

`rooms.status` hỗ trợ đầy đủ `CREATED | WAITING | ACTIVE | COMPLETED | CANCELLED | ABORTED`. `rooms.sync_status` và `violation_logs.sync_status` dùng đúng `PENDING | SYNCED | FAILED`. `violation_logs` có `event_id`, `session_id`, nullable `room_id`, `user_id`, `started_at`, `ended_at`, `duration_seconds`, `sync_status`, `created_at`, `synced_at`. `entitlements` giữ riêng `local_premium`, `server_premium`, code hash và verification state; pending activation code đầy đủ nằm tạm thời trong Expo SecureStore để redeem online.

### 6.4 Offline event envelope

| Field | Purpose |
|---|---|
| `event_id` | UUID primary key và idempotency key |
| `event_type` | Allowlisted event type |
| `schema_version` | Payload contract version |
| `aggregate_type`, `aggregate_id` | Ordering và destination scope |
| `session_id` | Session reference khi áp dụng |
| `actor_uid` | Local audit only; backend dùng Auth token |
| `occurred_at_utc_ms` | Device-observed event time |
| `payload_json` | Versioned event payload |
| `sync_status` | `PENDING | SYNCED | FAILED` |
| `attempt_count`, `next_attempt_at` | Retry metadata; transient failures remain `PENDING` |
| `lease_expires_at` | Worker ownership and crash recovery while status remains `PENDING` |
| `last_error_code` | Stable non-sensitive error code |
| `created_at`, `synced_at` | Local audit timestamps |

Initial allowlist: `VIOLATION_RECORDED`, `SOLO_SESSION_COMPLETED`, `GROUP_SESSION_LOCAL_SUMMARY`. Lifecycle commands, votes, bill overrides, payment changes và activation redemption không được replay muộn từ offline queue.

## 7. API và Firestore contract

Wire-level request, response, required-field, response-version, per-function error và transaction-output contracts nằm trong [`docs/api-contracts.md`](api-contracts.md). Artifact này là canonical callable schema; prose table dưới đây chỉ là responsibility index.

### 7.1 Callable Functions

| Function | Authority/invariant |
|---|---|
| `completeRegistrationProfile` | Khởi tạo profile theo authenticated UID |
| `createRoom` | Monthly quota, unique PIN, Host membership |
| `joinRoomByPin` | WAITING state, capacity, idempotent membership |
| `startRoom` | Host-only `WAITING → ACTIVE` |
| `syncEvents` | Batch validation, receipts, idempotent domain effects |
| `requestEarlyExit` | Active Member, one open request |
| `decideEarlyExit` | Host-only, freeze Member stats on approval |
| `openTerminationVote` | Active Member, one active vote, 30-second expiry |
| `castTerminationVote` | Active Member, unexpired vote, idempotent ballot |
| `completeRoom` | Host-only `ACTIVE → COMPLETED`, open reconciliation |
| `acknowledgeMemberSync` | Member has flushed all eligible events through `endedAt` |
| `finalizeRoomScores` | All synced or explicit Host override |
| `calculateBillShares` | Reconciliation finalized, integer-only allocation |
| `applyBillOverrides` | Host-only, total and type validation |
| `setSettlementDetails` | Host-only room-scoped bank details; 30-day expiry |
| `markBillSharePaid` | Host-only manual state change |
| `redeemActivationCode` | One-time transaction and verified entitlement |
| `abortStaleRooms` | Scheduled stale-host transition to `ABORTED` |
| `cleanupExpiredVotes` | Scheduled physical cleanup; logical expiry uses `expiresAt` |

### 7.2 Client listeners

Client nghe room hiện tại, members, relevant requests, active vote/ballots, bill shares và room-scoped settlement details. PIN lookup không thực hiện từ client. Group violation history queries luôn bị giới hạn theo room/session và authorization-compatible shape. Solo history query dùng `users/{uid}/sessions`, `completedAt DESC`, cursor pagination và owner path.

### 7.3 Command idempotency

Mọi side-effecting command nhận `requestId` UUID và `version = 1`; event ingestion dùng `eventId`. Cùng ID và cùng canonical payload trả lại outcome cũ; cùng ID nhưng payload hash khác trả `already-exists`. Response và safe error shape tuân theo `docs/api-contracts.md`.

## 8. Offline-first synchronization

Sequence details: [`design/sequence-flows.mmd`](../design/sequence-flows.mmd).

`syncEvents` là canonical ingestion path cho mọi offline-capable event. Client không dùng direct `setDoc` cho `rooms/{roomId}/violations/{eventId}` hoặc Solo summaries. Đây là human-approved override của Feature Spec Section 6.3: UUID vẫn là document/idempotency key, nhưng Cloud Function phải validate actor, ownership, schema và session window trước khi transaction ghi domain document cùng receipt.

### 8.1 Atomic local capture

1. Domain engine tạo event sau khi business condition được thỏa mãn.
2. Một SQLite transaction ghi typed domain record và `sync_outbox` item.
3. UI chỉ báo đã ghi nhận sau commit.
4. Crash trước commit không để lại half-written event.

### 8.2 Worker triggers

Worker chạy sau local commit khi online, network recovery, app startup, auth restore, app resume và opportunistic background task. Network reachability là tín hiệu; kết quả request mới là authority.

### 8.3 Lease, batching và retry

1. Chọn bounded batch các item `PENDING` đã đến `next_attempt_at` và chưa có lease còn hiệu lực.
2. Trong SQLite transaction, gán `lease_expires_at` nhưng giữ `sync_status = PENDING`.
3. Gửi `syncEvents`.
4. Áp dụng per-event acknowledgment trong SQLite transaction.
5. Success thành `SYNCED`.
6. Transient error giữ `PENDING`, tăng attempt count và đặt exponential backoff với jitter.
7. Expired lease được worker sau claim lại mà không đổi vocabulary.
8. Permanent schema, ownership hoặc lifecycle rejection thành `FAILED`; không retry vô hạn.

Ordering được giữ trong cùng aggregate. Các aggregate độc lập có thể sync song song. `SOLO_SESSION_COMPLETED` không vượt qua violation cũ hơn của cùng session.

### 8.4 Backend idempotency

`syncEvents` xác thực actor từ Auth token, validate envelope và event schema, rồi dùng Firestore transaction:

1. Đọc `syncReceipts/{eventId}`.
2. Nếu receipt cùng hash đã tồn tại, trả outcome cũ.
3. Nếu receipt có hash khác, reject collision/tampering.
4. Nếu chưa tồn tại, ghi domain event, cập nhật aggregate và ghi receipt trong cùng transaction.

Semantics là at-least-once delivery với idempotent effect. Không tuyên bố exactly-once network delivery.

### 8.5 Mark và cleanup

Backend success được commit local thành `SYNCED` trước khi outbox payload đủ điều kiện purge. Domain record được giữ theo retention policy độc lập. Local Premium giữ permanent SQLite `Violation Log`; nếu không có Local Premium, local logs cũ hơn 7 ngày bị purge. Firestore Solo session summary chỉ được giữ permanent khi `users/{uid}.isPremium` đã verified; nếu không, server purge summaries cũ hơn 7 ngày. `FAILED` được giữ đủ để diagnostics giải thích lỗi và chỉ bị dọn theo retention policy đã định.

### 8.6 Unexpected network loss

- Solo session tiếp tục đầy đủ.
- Active group session tiếp tục sensor tracking và local event capture.
- Create/join/lifecycle/vote/bill/payment commands hiển thị offline state và không được queue để replay muộn.
- Firestore snapshot không xóa local pending events.
- Event đến muộn chỉ được chấp nhận nếu `occurredAt` nằm trong authoritative active session window.

### 8.7 Completion reconciliation

`completeRoom` chuyển room sang `COMPLETED` và đặt `reconciliationStatus = PENDING`. Mỗi Member flush event đến `endedAt`, sau đó gọi `acknowledgeMemberSync`.

- Khi mọi relevant Member đã acknowledgment, server finalizes score với `ALL_SYNCED`.
- Khi còn Member chưa sync, Host phải thấy đúng warning: **“Some Members have not synced. Late violations will not affect payment.”**
- Host chỉ có thể chọn explicit override sau warning. `finalizeRoomScores` finalizes với `HOST_OVERRIDE` và atomically ghi append-only `reconciliationAudits` document.
- Audit document ghi Host UID, request ID, room end time, unsynced Member UIDs, timestamp và resulting score snapshot reference.
- `calculateBillShares` bị chặn cho đến khi reconciliation `FINALIZED`.
- Late valid event sau Host override vẫn được lưu vào history nhưng có `excludedFromFinalScore = true`, `exclusionReason = HOST_OVERRIDE` và không sửa bill đã khóa.

Policy này được human-approved theo F-04 ngày 2026-09-23. Nó tránh timeout tùy ý, giữ quyết định Host có audit trail và không thay đổi VietQR sau khi settlement bắt đầu.

## 9. Lifecycle và business rules

### 9.1 Room lifecycle

Valid transitions:

- `CREATED → WAITING`
- `WAITING → ACTIVE`
- `ACTIVE → COMPLETED`
- `ACTIVE → CANCELLED`
- `ACTIVE → ABORTED`

`CANCELLED` cần 100% active Member consensus trước vote `expiresAt`. Logical expiry đúng 30 giây dựa trên server timestamp; scheduled cleanup có thể xảy ra muộn hơn mà không thay đổi hành vi.

### 9.2 Penalty Score

Authoritative formula:

$$\text{Penalty Score} = (\text{Lift Count} \times 10) + \text{Violation Duration Seconds}$$

Client tính preview. Backend aggregate là authoritative và chỉ cộng event khi receipt/destination chưa tồn tại.

### 9.3 Bill allocation

- Chỉ dùng integer VND.
- Tỷ trọng 40/60 được biểu diễn bằng integer basis points `4000/6000`.
- `totalBillVnd` là positive integer tối thiểu 1.000; không cần chia hết cho 1.000.
- Default Hybrid Bill Allocation và Host overrides cùng tạo raw share vector; không có remainder-after-override branch.
- Round mỗi raw share tới 1.000 VND gần nhất bằng integer arithmetic; trường hợp đúng 500 VND round lên mốc 1.000 kế tiếp. Tính $\Delta = totalBillVnd - \sum roundedShares$, rồi phân phối từng bước ±1.000 theo residual rank.
- Nếu còn sub-1.000 VND residual, áp dụng chính xác phần còn lại cho eligible Member đứng đầu cùng rank; tie-break bằng Member UID tăng dần và không được tạo share âm.
- Early Exit Member được tính bằng score đã đóng băng.
- Invariant bắt buộc: tổng final shares bằng chính xác `totalBillVnd`; tối đa một final share không chia hết cho 1.000.

### 9.4 Layered Premium entitlement

Offline checksum hợp lệ mở **Local Premium** ngay: ad-free, permanent local `Violation Log` retention và custom themes. Nó không chứng minh purchase/redemption và không mở server quota hoặc capacity.

`redeemActivationCode` online mới mở **Server Premium**: unlimited room capacity, unlimited monthly room creation và advanced Penalty Leaderboard. Function atomically redeem hashed code và đặt `users/{uid}.isPremium = true`; app sau đó đồng bộ `server_premium`, xóa pending code khỏi SecureStore và giữ Firestore làm authority cho server benefits. Chi tiết quyết định nằm trong ADR-007.

## 10. Error handling

Stable callable codes:

- `unauthenticated`
- `permission-denied`
- `invalid-argument`
- `failed-precondition`
- `not-found`
- `already-exists`
- `resource-exhausted`
- `unavailable`

Transient transport/service failures được retry. Validation, permission và terminal lifecycle conflicts không retry tự động. Registration/login dùng generic error để tránh user enumeration. UI luôn có loading, empty, error, offline và syncing states theo Feature Spec.

## 11. Deployment shape

### 11.1 Environment matrix

| Concern | Development | Production |
|---|---|---|
| Firebase project ID | Not provisioned; executable config deferred by human decision on 2026-09-23 | Not provisioned; executable config deferred by human decision on 2026-09-23 |
| Firebase alias | `development` after provisioning | `production` after provisioning |
| Firestore edition/location | Standard / `asia-southeast1` | Standard / `asia-southeast1` |
| Functions runtime/region | 2nd gen / `asia-southeast1` | 2nd gen / `asia-southeast1` |
| Auth provider | Email/Password only for MVP | Email/Password only for MVP |
| EAS profile/environment | `development` / `development` | `production` / `production` |
| Native Firebase config | Development-scoped `GOOGLE_SERVICES_JSON` and `GOOGLE_SERVICES_INFO_PLIST` file variables | Production-scoped variables with the same names |
| Distribution | Internal Development Build | Store-signed binary |

Development và production phải là hai dedicated DontLift Firebase projects; không được trỏ hai aliases vào cùng project. Firestore location là immutable và phải được xác nhận trước provisioning.

### 11.2 Mobile build contract

- Expo SDK 57 và React Native Firebase chạy trong Development Build; Expo Go không được hỗ trợ.
- Dynamic Expo app config chọn Android/iOS Firebase file variables theo EAS environment, không commit credentials hoặc dùng production config trong development build.
- Native dependency/config change tạo binary mới. EAS Update chỉ dùng khi runtime version còn tương thích.
- `development` profile bật development client và internal distribution. `production` profile dùng production environment và store distribution.

### 11.3 Ordered provisioning and deployment

1. Tạo hai dedicated Firebase projects và ghi exact project IDs vào `.firebaserc` aliases `development` và `production`.
2. Trong mỗi project, đăng ký Android/iOS apps, bật Email/Password Auth và tải đúng native config files vào environment-scoped EAS file variables.
3. Provision default Cloud Firestore Standard tại `asia-southeast1`; không tiếp tục nếu location khác.
4. Nâng project lên Blaze plan, cấu hình Cloud Functions 2nd gen tại `asia-southeast1` và cho phép tạo Cloud Scheduler jobs.
5. Validate Security Rules và indexes bằng Emulator Suite. Rules phải deny-by-default, enforce owner/membership reads và chặn direct authoritative writes.
6. Deploy theo thứ tự: Security Rules, Firestore indexes, Cloud Functions, rồi Scheduled Functions/TTL policies. Không build mobile binary trước khi backend deployment và smoke checks pass.
7. Chạy callable smoke checks cho Auth, create/join, `syncEvents`, reconciliation, settlement và activation trên development.
8. Tạo EAS `development` binaries cho Android/iOS; xác nhận app kết nối đúng development project/region.
9. Chỉ sau development gate, lặp lại deploy có explicit `production` alias, chạy production smoke checks không phá dữ liệu, rồi tạo EAS `production` binaries.

### 11.4 Deferred executable configuration

`.firebaserc`, `firebase.json`, `firestore.rules`, `firestore.indexes.json` và `eas.json` chưa được tạo vì chưa có dedicated DontLift Firebase project IDs. Đây là explicit scope reduction được human-approved ngày 2026-09-23, không phải placeholder configuration. Các files này chỉ được tạo khi cả hai exact IDs tồn tại; không dùng một unrelated Firebase project tạm thời.

## 12. Rủi ro và biện pháp

| Risk | Consequence | Mitigation |
|---|---|---|
| Native Firebase upgrade coupling | Build failure hoặc native regression | Pin compatible versions, rebuild both platforms |
| Firestore cache + SQLite projection | Stale/duplicate local state | Single repository merge boundary và explicit precedence |
| Background task không chạy đúng giờ | Delayed sync | Durable outbox + startup/resume/network triggers |
| Client clock không đáng tin hoàn toàn | Timestamp manipulation | Session-window validation, server `receivedAt`, anomaly rejection |
| Host override khi Member chưa sync | Late event không vào final bill | Explicit warning, audit reason, preserve late event in history |
| 4-digit PIN chỉ có 10.000 giá trị | Collision/enumeration | Transactional reservation, server-only lookup, throttling |
| Premium “unlimited participants” | Listener, vote và cost growth | Subcollections, pagination/virtualization, monitor production limits |
| Offline checksum có thể reverse-engineer | Fake server premium claim | Chỉ mở Local Premium; server quota/capacity cần online redemption |
| Receipt collection growth | Storage/index cost | Firestore TTL longer than maximum retry window |
| Scheduled cleanup không chính xác từng giây | Stale physical documents | Logical expiry based on `expiresAt` |

App Check không phải dependency bắt buộc của MVP. Functions và client contracts phải giữ khả năng bật App Check enforcement sau khi release attestation được kiểm chứng.

## 13. ADR map

- [`ADR-001-firebase-native-stack.md`](decisions/ADR-001-firebase-native-stack.md)
- [`ADR-002-offline-first-sqlite.md`](decisions/ADR-002-offline-first-sqlite.md)
- [`ADR-003-authoritative-command-boundary.md`](decisions/ADR-003-authoritative-command-boundary.md)
- [`ADR-004-firestore-ownership-and-rules.md`](decisions/ADR-004-firestore-ownership-and-rules.md)
- [`ADR-005-vietqr-p2p.md`](decisions/ADR-005-vietqr-p2p.md)
- [`ADR-006-regional-deployment.md`](decisions/ADR-006-regional-deployment.md)
- [`ADR-007-layered-premium-entitlement.md`](decisions/ADR-007-layered-premium-entitlement.md)
- [`ADR-008-platform-session-lifecycle.md`](decisions/ADR-008-platform-session-lifecycle.md)

## 14. Open questions

Không còn open architecture decision. Dedicated development/production Firebase project IDs là external provisioning prerequisite đang được defer; chúng không được thay bằng placeholder hoặc unrelated project. Batch size, retry ceilings, receipt TTL và heartbeat frequency là implementation/deployment tuning values phải được đo và cố định trong implementation plan mà không thay đổi approved contracts.

## 15. Validation obligations

- Rules emulator tests cho create/update bypass, ownership, type/size validation và query compatibility.
- Functions tests cho idempotency, lifecycle transitions, quota, votes, reconciliation và bill invariants.
- SQLite tests cho atomic domain+outbox write, lease recovery, ordering, retry và purge.
- Device tests trên Android/iOS cho grace cancel/confirm, unexpected network loss, app restart, reconnect, iOS background-task expiration và Android WorkManager delay.
- Bill property tests bảo đảm integer arithmetic và `SUM(shares) = totalBillVnd`.
- Mermaid files phải parse thành công trước khi artifact package được xem là hoàn tất.
