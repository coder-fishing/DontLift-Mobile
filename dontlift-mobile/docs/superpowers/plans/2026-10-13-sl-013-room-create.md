# Kế hoạch triển khai P6.1 — SL-013: Host tạo room

> **For agentic workers:** REQUIRED SUB-SKILL: Use the qskill-executing-plans skill to implement this plan task-by-task. Steps use checkbox tracking.
> Kế hoạch chỉ mô tả file, unit, hành vi, quy tắc, đầu ra và test cases; không có implementation code hoặc signatures. Đọc source thật trước mỗi task.
> **Gate:** Execution được human duyệt riêng cho SL-013 ngày 2026-10-20 sau khi chốt D12/D13 và chuyển createRoom sang Security Rules để giữ Firebase Spark.

**Mục tiêu:** Host tạo room: WAITING room, unique PIN, Host membership và quota count committed; Host lobby hiển thị scannable invitation QR từ PIN đã được server xác nhận.

**Slice:** SL-013. **Ưu tiên đề xuất:** P0. **Release:** MVP + activation/Premium; post-MVP deferred. SL-036 chỉ được tính release sau D6.

**Trạng thái kế hoạch:** APPROVED — human duyệt execution SL-013 ngày 2026-10-20; D12/D13 đã giải quyết.
**Approval evidence:** Human chọn Firebase Spark, không bật billing; duyệt Rules-authorized Firestore transaction, D12 `Asia/Ho_Chi_Minh`, và D13 `dontliftmobile://room/{PIN}` ngày 2026-10-20.
**Trạng thái implementation quan sát:** Room/PIN hiện là mock; chưa có create command. Chưa có evidence nghiệm thu slice.
**Baseline khảo sát:** docs/p6.0-implementation-slices tại 57ca1eb28a2952c66d01f89b9b89bf755ab4812a.
**Ngày soạn:** 2026-10-13, Asia/Saigon.
**Plan slug:** `2026-10-13-sl-013-room-create`; mọi commit thực hiện plan này phải bắt đầu `[2026-10-13-sl-013-room-create]`.
**Đầu vào phạm vi:** Backlog P6.0 v0.1 trong cuộc trò chuyện ngày 2026-10-13, chưa được phê duyệt. User đã yêu cầu ghi draft P6.1 cho cả 37 slice; không suy thành approval thực thi.
**Traceability:** US-06; API §2; ADR-003/004; V05.
**Phụ thuộc bắt buộc:** [SL-003](./2026-10-13-sl-003-registration-profile.md), [SL-004](./2026-10-13-sl-004-login-session.md), [SL-006](./2026-10-13-sl-006-solo-start.md)
**Ưu tiên mềm:** Theo thứ tự đề xuất trong [mục lục](../../implementation-plan.md); thứ tự không tạo thêm hard dependency.

## 1. Nguồn và ranh giới

Đọc [PRD](../../product-requirements.md), [Feature Spec](../../feature-specification.md), [Product Design](../../product-design.md), [Design Brief](../../product-design-brief.md), [Architecture](../../software-architecture.md), [API contracts](../../api-contracts.md), ADR áp dụng trong [decisions](../../decisions), cùng AGENTS ở app root. Tham chiếu cụ thể của slice nằm trong Traceability phía trên.

V01–V10 chỉ các màn tương ứng tại `design/concepts/concept-final/screens/`; prototype nằm tại `prototype/`. Chúng là read-only visual/interaction references, không chứng minh integration. Nếu journey không có design screen, trình bày gap với human trước quyết định UI mới.

**Kiến trúc:** Client Firebase JS transaction tạo room; Firestore Security Rules là authority, ràng buộc Auth UID, `request.time`, PIN reservation uniqueness, quota và mọi document link bằng `getAfter()`. Presentation đọc kết quả qua repository. Không dùng Cloud Functions cho createRoom để chạy trên Firebase Spark. Các callable khác không đổi.

**Stack:** Expo SDK 57 / React Native / TypeScript; Firebase JS SDK; Firestore Standard và Security Rules; SQLite cho projection cục bộ. Tạo room cần kết nối mạng và không được queue offline.

**Không gồm:** Join, realtime lobby, redeem code hoặc generate production credentials.

## 2. Blocker, risk và quyết định cần duyệt

- **D12 — RESOLVED 2026-10-20:** Calendar timezone là `Asia/Ho_Chi_Minh`. Firestore Rules tính bucket từ server `request.time` cộng UTC+07:00; app đọc server-time probe để chuẩn bị transaction. Device clock/timezone không cấp quota.
- **D13 — RESOLVED 2026-10-20:** Canonical invitation là `dontliftmobile://room/{PIN}`, trong đó PIN là chuỗi đúng bốn chữ số, giữ số 0 đầu. Scheme khớp `app.json`; SL-015 phải parse đúng payload này.

**Rủi ro cụ thể:** Rules transaction phải được Emulator Suite chứng minh chặn quota/PIN/document bypass và không vượt access-call limits. Không có Cloud Functions deployment trong slice. Expo Go trên Firebase Cloud chỉ hoạt động khi project hiện tại đã có Firestore Standard, Auth, Rules và Spark quota còn đủ; provisioning E1 vẫn là blocker cho cloud/device evidence.

Nếu một contract chỉ có responsibility mà chưa có schema, task đầu là trình bày missing decision với nguồn; không tự tạo endpoint/field mới. Các hành vi test bên dưới mô tả outcome cần đạt, không thay thế wire approval. Ngưỡng/range/default chưa được spec xác định phải có quyết định ghi lại trước khi implement.

## 3. File và quyền sở hữu dự kiến

Các đường dẫn sau tương đối với `dontlift-mobile/`. Đọc lại trạng thái file lúc execute để chọn Create/Modify; không ghi đè implementation của dependency.

| File dự kiến | Trách nhiệm |
|---|---|
| `src/features/rooms/room-command-port.ts` | Unit/repository/adapter chuyên trách; reuse nếu prerequisite đã tạo. |
| `src/features/rooms/room-repository.ts` | Unit/repository/adapter chuyên trách; reuse nếu prerequisite đã tạo. |
| `src/features/rooms/room-invite-contract.ts` | SL-013 sở hữu encoder và canonical invitation contract sau D13; SL-015 reuse để parse/validate, không tạo scheme thứ hai. |
| `src/components/RoomInvitationQr.tsx` | Render QR thật từ canonical payload cho Host trong GroupLobby bằng `toqr` và `react-native-svg`; không dùng QR fixture. |
| `package.json` | Khai báo `toqr` trực tiếp (đã có trong dependency tree) và reuse `react-native-svg` hiện có; không thêm native module. |
| `package-lock.json`, `pnpm-lock.yaml` | Cập nhật đồng bộ để `toqr` là dependency trực tiếp. |
| `app.json` | SL-013 đồng bộ invitation scheme với D13 khi cần; SL-015 mở rộng cấu hình scanner/permission. |
| `__tests__/room-invitation.test.ts` | Encoder/render payload, PIN giữ leading zero và failure states; SL-015 kiểm chứng producer/parser round-trip cùng scan thật. |
| `src/features/local/migrations.ts` | SL-013 mở rộng migration runner SL-003 bằng schema có version cho `rooms` và `room_members` sau sessions migration SL-006, theo architecture §6.3; giữ các version đã có, không khởi tạo database thứ hai. |
| `src/screens/GroupLobbyScreen.tsx` | Presentation và states của journey; không chứa domain math/sync authority. |
| `firestore.rules` | Enforce toàn bộ invariants createRoom trên server, chỉ cho phép transaction đồng nhất của authenticated Host. |
| `__tests__/room-create.test.ts` | Kiểm thử dự kiến; chưa tạo test source trong P6.1. |
| `__tests__/room-migrations.test.ts` | Fresh-install và upgrade coverage cho room/member projections; chưa tạo test source trong P6.1. |
| `functions/tests/room-create.rules.emulator.test.cjs` | Rules Emulator Suite: transaction hợp lệ, quota, PIN collision, Auth, ownership, atomicity và time-bucket validation. |

**Unit:** createRoom.
**Nhận:** Authenticated actor và version/requestId theo API §2.
**Trả:** WAITING room, unique PIN, Host membership và quota count committed.
**Đầu vào từ dependency:** capabilities/records/commands đã nghiệm thu theo các plan liên kết; chưa có dependency output thì không giả coi integration có thật.
**Đầu ra cho slice sau:** outcome và invariants trong mục tiêu/nghiệm thu dưới đây; tên internal unit là đề xuất, wire names chỉ dùng theo API/ADR đã duyệt.

### Contract dữ liệu đã có

**Unit invitation encoder/renderer:** Nhận PIN hợp lệ từ createRoom và contract D13 đã duyệt; trả canonical payload cùng QR hiển thị cho Host. Giữ leading zero, không encode Auth token hoặc thông tin ngân hàng; lỗi không che PIN hoặc giả lập QR thành công. SL-015 tiêu thụ đúng payload này.

Bảng dưới là trích ranh giới từ API đã duyệt, không tạo schema mới. Common response giữ version/requestId/serverTimeUtcMs khi contract yêu cầu; full required fields/errors/transaction outputs vẫn theo API section được tham chiếu.

| Field | Bắt buộc / hướng | Quy tắc |
|---|---|---|
| version | Bắt buộc | 1, theo common envelope. |
| requestId | Bắt buộc | UUID; cùng actor/payload replay trả prior outcome, payload khác bị collision. |

## 4. Ràng buộc xuyên suốt

- Giữ approved architecture; newer human decisions và accepted ADR exceptions thắng prose cũ.
- Không sao chép Firebase token vào SQLite, AsyncStorage hoặc SecureStore; SDK quản lý session.
- Event offline-capable dùng SQLite domain record và sync_outbox trong một transaction; syncEvents là ingestion authority.
- Command lifecycle/vote/bill/payment không queue để replay muộn. Firestore cache không thay thế outbox.
- Membership authority là rooms/{roomId}/members/{uid}. Với createRoom, Rules derive Host từ Auth và validate giao dịch theo ADR-011; Functions/Admin SDK vẫn là authority cho các callable khác.
- Giữ 3-Second Grace Period ở cả foreground/background theo ADR-008.
- Local Premium không cấp server quota/capacity; chỉ verified Server Premium cấp server benefits.
- Bill dùng integer VND, deterministic residual và tổng exact theo ADR-005; VietQR non-custodial, không bank polling.
- UI dùng semantic tokens và accepted Liquid Acrylic; loading/empty/error/offline/syncing, labels, safe areas và touch targets được kiểm chứng khi phù hợp.
- Không thêm social login, analytics dashboards, kiosk, wallet, chat, AI coaching hoặc camera-based detection vào MVP.
- Execution đã được human duyệt. Chỉ sửa mã/docs và chạy kiểm tra local trong slice này; không bật billing, provision project hoặc deploy lên Firebase Cloud khi chưa được yêu cầu.

## 5. Các task thực hiện sau approval

### Task 1 — Boundary và quy tắc của Host tạo room

**Files:** Dùng Firestore Rules, repository, local migration và app tests trong bảng mục 3. CreateRoom dùng client SDK transaction; không thêm Cloud Function.

**Nhận/trả:** Nhận authenticated user, requestId, roomId và PIN candidate theo API §2; trả WAITING room, unique PIN, Host membership và quota count committed. Rules là authority.

- [ ] Đọc lại source/spec và xác nhận tất cả blocker cùng dependency cho task đã được giải quyết; nếu chưa, dừng execution và báo đúng blocker.
- [ ] Viết focused failing cases sau đây; runner không tìm thấy hoặc thiếu dependency không được tính là red nghiệp vụ.

- [ ] Free quota còn → một room/membership/counter.
- [ ] Quota đã 7 → resource-exhausted, không room/counter mới.
- [ ] Hai create cùng request → một room.
- [ ] Fresh install → migration tạo schema room/member trước khi repository ghi projection.
- [ ] Upgrade từ database đã có profile/session migrations → room/member schema được thêm, dữ liệu cũ còn nguyên.
- [ ] Ngay trước/sau ranh giới tháng theo D12 → đúng usage bucket và quota; device clock/timezone thay đổi không đổi kết quả server; replay cùng request qua boundary không double-count.

- [ ] Chạy focused command trong mục 7; xác nhận failure đúng behavior đang thiếu, không từ toolchain lỗi.
- [ ] Xây hành vi theo thứ tự sau, chỉ sau approval:

1. Derive Host từ `request.auth.uid`; đọc `users/{uid}.isPremium` từ Firestore Rules, không dùng Local Premium hoặc UI role.
2. Database readiness áp dụng migration runner do SL-003 khởi tạo và schema sessions từ SL-006; thêm room/member migration ở version tiếp theo chưa sử dụng, giữ version và dữ liệu profile/session. Room/member tables theo architecture §6.3 tồn tại trước projection writes.
3. Lấy server time qua Rules-validated timestamp probe, rồi reserve PIN, tạo room/membership/counter/receipt trong một transaction.
4. Rules kiểm tra `Asia/Ho_Chi_Minh` bucket theo server request time; Free Host tối đa 7 room/tháng; replay cùng request không tăng quota lần nữa.
5. PIN candidate collision hoặc month rollover giữa probe và commit không tạo partial writes; báo lỗi an toàn để user retry với cùng request ID.

- [ ] Chạy lại các cases và đối chiếu output/invariants; không tuyên bố native/integration PASS từ mock.
- [ ] Review task và commit chỉ files thuộc task nếu execution được phép. Subject dùng `[2026-10-13-sl-013-room-create]`, trailer `Plan: docs/superpowers/plans/2026-10-13-sl-013-room-create.md` và `Task: 1`.

### Task 2 — Journey tích hợp và recovery

**Files:** Presentation/adapter/evidence trong mục 3 cùng boundary task 1; không refactor screen không liên quan. Task này không tạo implementation thứ hai cho unit task 1.

**Nhận:** Output task 1 đã kiểm chứng. **Trả:** Journey/bằng chứng có thể nghiệm thu; error/offline không false-success.

- [ ] Viết các failing cases về integration/recovery sau; không viết tests chỉ mirror implementation.

- [ ] Concurrent PIN collision → server reserve khác hoặc safe retry, không duplicate PIN.
- [ ] Local Premium nhưng server Free → vẫn áp Free quota.
- [ ] Actor chưa login → unauthenticated.

- [ ] Chạy focused checks, xác nhận failure đúng behavior; giữ fixtures tách khỏi device evidence.
- [ ] Invitation test: PIN leading zero giữ nguyên payload; renderer nhận đúng canonical payload; encode/render failure giữ PIN và không báo QR sẵn sàng.
- [ ] Tích hợp theo thứ tự:

1. Loading khóa Create; quota/error/offline rõ; offline không queue command.
2. Chỉ hiện PIN/invitation sau transaction commit; cache room metadata SQLite sau cloud success.
3. Rules kiểm tra verified server Premium; Local Premium không mở quota.
4. Encode `dontliftmobile://room/{PIN}`, giữ đủ bốn chữ số và không chứa credentials. Render QR thật trong Host view; lỗi encode/render giữ PIN nhưng không báo QR sẵn sàng.

- [ ] Thực hiện các kịch bản nghiệm thu trực tiếp trong mục 6; thu logs an toàn/device timestamps khi cần.
- [ ] Review kết quả; một branch fail hoặc thiếu required device/emulator evidence thì slice chưa hoàn thành.
- [ ] Commit task sau review nếu execution được phép. Subject dùng `[2026-10-13-sl-013-room-create]`, trailer `Plan: docs/superpowers/plans/2026-10-13-sl-013-room-create.md` và `Task: 2`.

## 6. Nghiệm thu và failure outcomes

- [ ] Free quota còn → một room/membership/counter.
- [ ] Quota đã 7 → resource-exhausted, không room/counter mới.
- [ ] Hai create cùng request → một room.
- [ ] Concurrent PIN collision → server reserve khác hoặc safe retry, không duplicate PIN.
- [ ] Local Premium nhưng server Free → vẫn áp Free quota.
- [ ] Actor chưa login → unauthenticated.
- [ ] Auth+Firestore emulators tạo room bằng transaction → inspect outputs; không cần Functions emulator cho SL-013.
- [ ] Month bucket theo `Asia/Ho_Chi_Minh` → Rules dùng server `request.time`; unit tests kiểm tra hai phía tháng boundary.
- [ ] Device clock/timezone thay đổi → server-time probe giữ bucket đúng; replay request qua boundary không tạo room hoặc tiêu hao quota lần hai.
- [ ] PIN có leading zero → canonical payload giữ đủ bốn chữ số; QR render dùng đúng payload và room đã tạo, không fixture.
- [ ] QR encode/render lỗi → PIN vẫn dùng được, không hiển thị QR thành công giả; D13 chưa duyệt → chưa nghiệm thu invitation.
- [ ] Fresh install và upgrade từ profile/session schema → room/member migration chạy tuần tự, không mất dữ liệu cũ.

Mỗi case phải có actual result. Unit cases dùng controlled fixtures để chứng minh domain; Firebase boundary dùng Rules Emulator tests cho allowed/denied/replay/concurrency. Sensor/lifecycle cần physical devices. Không có evidence thì ghi UNVERIFIED và blocker, không tick PASS.

**Failure recovery bắt buộc:** không hiển thị successful save/transition khi commit/request chưa thành công; giữ dữ liệu/retry context theo hành vi cụ thể trong tasks. Không log email đầy đủ, token, activation code hoặc bank details. Case không áp dụng cho slice phải ghi lý do trong evidence, không bỏ im lặng.

## 7. Verification và ghi nhận evidence

Invitation focused test sau SL-001: `pnpm test --runTestsByPath __tests__/room-invitation.test.ts`. Backend room-create suite phải bao gồm các case timezone/rollover/replay nêu trên sau D12; SL-015 nghiệm thu scan từ QR do SL-013 render.

App focused tests sau khi SL-001 cấu hình runner: `pnpm test --runTestsByPath __tests__/room-create.test.ts __tests__/room-migrations.test.ts`. Backend focused tests sau backend bootstrap SL-003 và native/emulator prerequisites SL-002: `node --test functions/tests/room-create.test.cjs`. TypeScript: `pnpm exec tsc --noEmit`. Lint: `pnpm run lint` chỉ khi repository có ESLint setup thực tế.

Lệnh app chạy từ `dontlift-mobile/`; file paths tests/backend ở trên là planned targets. Command chỉ được chạy sau harness/dependency prerequisites. Native build/emulator commands phải lấy từ cấu hình thật sau SL-002; không đoán project ID, runtime hoặc production alias. Future schema/index changes được test với approved edition Standard.

Ghi trong kết quả execution: baseline/commit mới, command, exit status, số cases, emulator/device/runtime version, date, actual outcomes và remaining gaps. Các checklist hiện đều chưa chạy.

## 8. Human review và bàn giao P6.2

Human đã duyệt scope, non-goals, tasks, acceptance cases, dependencies, D12, D13 và đổi authority sang Rules transaction cho **SL-013** ngày 2026-10-20. Duyệt một slice không duyệt tất cả 37.

Execution được thực hiện inline trên `feature/sl-013-room-create`. Không commit/push/PR theo yêu cầu hiện tại. Không bật billing, provision project hoặc deploy Rules/backend trong quá trình này. Không tự bắt đầu P6.2.

## Execution evidence — 2026-10-20

- **PASS:** `node_modules/.bin/tsc --noEmit`.
- **PASS:** `node_modules/.bin/jest --runInBand __tests__/local-database.test.ts __tests__/room-invitation.test.ts` — 2 suites, 16 tests.
- **PASS:** package JSON/lockfile parse, `pnpm-lock.yaml` importer check, and `git diff --check`.
- **PASS (follow-up):** Firestore emulator using Android Studio bundled Java; `node --test functions/tests/room-create.rules.emulator.test.cjs` — 5/5 cases passed. Corrected test fixture to include `lastRequestId` and inspect rejected transaction state through the test admin context.
- **PASS (follow-up):** After user reauthenticated Firebase CLI, confirmed the app's default Cloud database is STANDARD with `freeTier: true`. Deployed only `firestore:rules` using `firebase.json`; compilation and Cloud release succeeded.
- **UNVERIFIED:** Expo Go render, QR scan on a second device, and full transaction against the user's Firebase project.
- No commit, push, PR, billing change, provisioning, or Functions deployment was performed. Rules-only deployment completed in the permission-denied follow-up after user reauthentication.
