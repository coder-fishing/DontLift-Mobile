# Kế hoạch triển khai P6.1 — SL-013: Host tạo room

> **For agentic workers:** REQUIRED SUB-SKILL: Use the qskill-executing-plans skill to implement this plan task-by-task. Steps use checkbox tracking.
> Kế hoạch chỉ mô tả file, unit, hành vi, quy tắc, đầu ra và test cases; không có implementation code hoặc signatures. Đọc source thật trước mỗi task.
> **Gate:** Không execute kế hoạch khi trạng thái còn DRAFT hoặc khi blocker/dependency chưa giải quyết. Việc tạo file này không phê duyệt backlog hay P6.2.

**Mục tiêu:** Host tạo room: WAITING room, unique PIN, Host membership và quota count committed; Host lobby hiển thị scannable invitation QR từ PIN đã được server xác nhận.

**Slice:** SL-013. **Ưu tiên đề xuất:** P0. **Release:** MVP + activation/Premium; post-MVP deferred. SL-036 chỉ được tính release sau D6.

**Trạng thái kế hoạch:** DRAFT — chưa được human duyệt; bị chặn bởi D12 và D13.
**Trạng thái implementation quan sát:** Room/PIN hiện là mock; chưa có create command. Chưa có evidence nghiệm thu slice.
**Baseline khảo sát:** docs/p6.0-implementation-slices tại 57ca1eb28a2952c66d01f89b9b89bf755ab4812a.
**Ngày soạn:** 2026-10-13, Asia/Saigon.
**Plan slug:** `2026-10-13-sl-013-room-create`; mọi commit thực hiện plan này phải bắt đầu `[2026-10-13-sl-013-room-create]`.
**Đầu vào phạm vi:** Backlog P6.0 v0.1 trong cuộc trò chuyện ngày 2026-10-13, chưa được phê duyệt. User đã yêu cầu ghi draft P6.1 cho cả 37 slice; không suy thành approval thực thi.
**Traceability:** US-06; API §2; ADR-003/004; V05.
**Phụ thuộc bắt buộc:** [SL-003](./2026-10-13-sl-003-registration-profile.md), [SL-004](./2026-10-13-sl-004-login-session.md)
**Ưu tiên mềm:** Theo thứ tự đề xuất trong [mục lục](../../implementation-plan.md); thứ tự không tạo thêm hard dependency.

## 1. Nguồn và ranh giới

Đọc [PRD](../../product-requirements.md), [Feature Spec](../../feature-specification.md), [Product Design](../../product-design.md), [Design Brief](../../product-design-brief.md), [Architecture](../../software-architecture.md), [API contracts](../../api-contracts.md), ADR áp dụng trong [decisions](../../decisions), cùng AGENTS ở app root. Tham chiếu cụ thể của slice nằm trong Traceability phía trên.

V01–V10 chỉ các màn tương ứng tại `design/concepts/concept-final/screens/`; prototype nằm tại `prototype/`. Chúng là read-only visual/interaction references, không chứng minh integration. Nếu journey không có design screen, trình bày gap với human trước quyết định UI mới.

**Kiến trúc:** createRoom sở hữu hành vi của slice. Presentation đọc kết quả qua controller/repository; không tự trở thành nguồn authoritative. Units và đường dẫn mới bên dưới là đề xuất, chưa tồn tại trên baseline; nếu prerequisite đã tạo cùng trách nhiệm thì reuse, không thêm convention thứ hai.

**Stack:** Expo SDK 57 / React Native / TypeScript. SQLite cho local-first khi slice có persistence; React Native Firebase Auth/Firestore Standard/Functions cho boundary có Firebase. Không bắt slice thuần local phải có network.

**Không gồm:** Join, realtime lobby, redeem code hoặc generate production credentials.

## 2. Blocker, risk và quyết định cần duyệt

- **D12:** Duyệt timezone calendar dùng để tính tháng quota và usage bucket `yyyyMM`; server clock là authority. Không chọn UTC hoặc device timezone ngầm.
- **D13:** Duyệt canonical invitation scheme/payload giữa ví dụ `dontlift` trong Feature Spec và `dontliftmobile` trong app config. Producer SL-013 và parser SL-015 phải dùng một contract.

**Rủi ro cụ thể:** Calendar timezone và throttling policy cần chốt P6.1; provisioning E1.

Nếu một contract chỉ có responsibility mà chưa có schema, task đầu là trình bày missing decision với nguồn; không tự tạo endpoint/field mới. Các hành vi test bên dưới mô tả outcome cần đạt, không thay thế wire approval. Ngưỡng/range/default chưa được spec xác định phải có quyết định ghi lại trước khi implement.

## 3. File và quyền sở hữu dự kiến

Các đường dẫn sau tương đối với `dontlift-mobile/`. Đọc lại trạng thái file lúc execute để chọn Create/Modify; không ghi đè implementation của dependency.

| File dự kiến | Trách nhiệm |
|---|---|
| `src/features/rooms/room-command-port.ts` | Unit/repository/adapter chuyên trách; reuse nếu prerequisite đã tạo. |
| `src/features/rooms/room-repository.ts` | Unit/repository/adapter chuyên trách; reuse nếu prerequisite đã tạo. |
| `src/features/rooms/room-invite-contract.ts` | SL-013 sở hữu encoder và canonical invitation contract sau D13; SL-015 reuse để parse/validate, không tạo scheme thứ hai. |
| `src/components/RoomInvitationQr.tsx` | Render QR thật từ canonical payload cho Host trong GroupLobby; không dùng SVG mô phỏng hoặc QR fixture. |
| `package.json` | SL-013 chọn và khai báo QR encoder/renderer tương thích Expo/native targets nếu manifest chưa có; reuse react-native-svg hiện có khi phù hợp. |
| `package-lock.json`, `pnpm-lock.yaml` | SL-013 cập nhật đồng bộ khi thêm QR dependency; không install trong lượt sửa plan. |
| `app.json` | SL-013 đồng bộ invitation scheme với D13 khi cần; SL-015 mở rộng cấu hình scanner/permission. |
| `__tests__/room-invitation.test.ts` | Encoder/render payload, PIN giữ leading zero và failure states; SL-015 kiểm chứng producer/parser round-trip cùng scan thật. |
| `src/features/local/migrations.ts` | SL-013 mở rộng migration runner SL-003 bằng schema có version cho `rooms` và `room_members` theo architecture §6.3; không khởi tạo database thứ hai. |
| `src/screens/GroupLobbyScreen.tsx` | Presentation và states của journey; không chứa domain math/sync authority. |
| `functions/src/create-room.cjs` | Backend boundary của slice; server identity/validation/transaction. |
| `functions/index.js` | Backend boundary của slice; server identity/validation/transaction. |
| `__tests__/room-create.test.ts` | Kiểm thử dự kiến; chưa tạo test source trong P6.1. |
| `__tests__/room-migrations.test.ts` | Fresh-install và upgrade coverage cho room/member projections; chưa tạo test source trong P6.1. |
| `functions/tests/room-create.test.cjs` | Kiểm thử dự kiến; chưa tạo test source trong P6.1. |

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
- Membership authority là rooms/{roomId}/members/{uid}. Functions derive actor từ Auth và tự authorization; Admin SDK bypass Rules.
- Giữ 3-Second Grace Period ở cả foreground/background theo ADR-008.
- Local Premium không cấp server quota/capacity; chỉ verified Server Premium cấp server benefits.
- Bill dùng integer VND, deterministic residual và tổng exact theo ADR-005; VietQR non-custodial, không bank polling.
- UI dùng semantic tokens và accepted Liquid Acrylic; loading/empty/error/offline/syncing, labels, safe areas và touch targets được kiểm chứng khi phù hợp.
- Không thêm social login, analytics dashboards, kiosk, wallet, chat, AI coaching hoặc camera-based detection vào MVP.
- Không install/provision/deploy/publish trong lượt authoring plan này; mọi check bên dưới là hướng dẫn execution sau approval.

## 5. Các task thực hiện sau approval

### Task 1 — Boundary và quy tắc của Host tạo room

**Files:** Dùng units/config/backend/repositories trong bảng mục 3; khi test source đã được chỉ định, đặt cases thuộc boundary vào đúng app/backend target. Không thay presentation chưa cần cho task này.

**Nhận/trả:** Nhận Authenticated actor và version/requestId theo API §2; trả WAITING room, unique PIN, Host membership và quota count committed. Với contract đang bị chặn, chưa có quyền thêm schema dù test outcome đã được nêu.

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

1. Derive Host từ Auth, đọc verified server entitlement; local checksum không cấp quota.
2. Database readiness áp dụng migration versioned do SL-003 khởi tạo; room/member tables theo schema architecture §6.3 tồn tại trước repository projection writes.
3. Reserve PIN, tạo room/membership/counter/receipt trong một transaction.
4. Free Host tối đa 7 room tháng calendar; retry cùng payload không tiêu hao quota lần nữa.
5. Chỉ sau D12, dùng server timestamp và timezone đã duyệt để xác định usage bucket; device timezone hoặc đổi giờ thiết bị không đổi quota. Kiểm tra ngay trước/sau ranh giới tháng và replay cùng request qua ranh giới theo receipt contract.

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
2. Chỉ hiện PIN/invitation từ server result đã validate và cache room metadata.
3. Đọc server Premium flag khi tạo; không hardcode role theo UI toggle.
4. Sau D13, encode invitation từ PIN server đã validate, giữ đủ bốn chữ số và không chứa credentials. Render QR thật trong Host lobby bằng dependency được xác minh tương thích; lỗi encode/render giữ PIN để join thủ công và không báo QR sẵn sàng.

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
- [ ] Auth+Functions+Firestore emulators tạo room → inspect transaction outputs.
- [ ] Ranh giới tháng theo timezone được duyệt → quota reset đúng; không tự chốt timezone.
- [ ] Device clock/timezone thay đổi → usage bucket vẫn theo server timestamp và D12; replay request qua ranh giới tháng không tạo room hoặc tiêu hao quota lần hai.
- [ ] PIN có leading zero → canonical payload giữ đủ bốn chữ số; QR render dùng đúng payload và room đã tạo, không fixture.
- [ ] QR encode/render lỗi → PIN vẫn dùng được, không hiển thị QR thành công giả; D13 chưa duyệt → chưa nghiệm thu invitation.
- [ ] Fresh install và upgrade từ profile/session schema → room/member migration chạy tuần tự, không mất dữ liệu cũ.

Mỗi case phải có actual result. Unit cases dùng controlled fixtures để chứng minh domain; Firebase boundary cần Rules/Functions emulator tests cho allowed/denied/replay/concurrency khi áp dụng. Sensor/lifecycle cần physical devices. Không có evidence thì ghi UNVERIFIED và blocker, không tick PASS.

**Failure recovery bắt buộc:** không hiển thị successful save/transition khi commit/request chưa thành công; giữ dữ liệu/retry context theo hành vi cụ thể trong tasks. Không log email đầy đủ, token, activation code hoặc bank details. Case không áp dụng cho slice phải ghi lý do trong evidence, không bỏ im lặng.

## 7. Verification và ghi nhận evidence

Invitation focused test sau SL-001: `pnpm test --runTestsByPath __tests__/room-invitation.test.ts`. Backend room-create suite phải bao gồm các case timezone/rollover/replay nêu trên sau D12; SL-015 nghiệm thu scan từ QR do SL-013 render.

App focused tests sau khi SL-001 cấu hình runner: `pnpm test --runTestsByPath __tests__/room-create.test.ts __tests__/room-migrations.test.ts`. Backend focused tests sau backend bootstrap SL-003 và native/emulator prerequisites SL-002: `node --test functions/tests/room-create.test.cjs`. TypeScript: `pnpm exec tsc --noEmit`. Lint: `pnpm run lint` chỉ khi repository có ESLint setup thực tế.

Lệnh app chạy từ `dontlift-mobile/`; file paths tests/backend ở trên là planned targets. Command chỉ được chạy sau harness/dependency prerequisites. Native build/emulator commands phải lấy từ cấu hình thật sau SL-002; không đoán project ID, runtime hoặc production alias. Future schema/index changes được test với approved edition Standard.

Ghi trong kết quả execution: baseline/commit mới, command, exit status, số cases, emulator/device/runtime version, date, actual outcomes và remaining gaps. Các checklist hiện đều chưa chạy.

## 8. Human review và bàn giao P6.2

Human phải duyệt scope, non-goals, tasks, acceptance cases, dependencies và các quyết định còn mở của **SL-013** trước implementation. Duyệt một slice không duyệt tất cả 37; duyệt authoring batch không duyệt code.

Sau approval, cập nhật trạng thái/date/decision evidence trong đúng plan; kế hoạch mới chỉ đủ execution-ready khi blocker đã được giải quyết và baseline được re-inspect. Dùng qskill-executing-plans khi user yêu cầu execute plan đã duyệt. Không tự bắt đầu P6.2 từ file draft hoặc từ prompt batch.
