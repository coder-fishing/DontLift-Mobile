# Kế hoạch triển khai P6.1 — SL-014: Member join bằng PIN

> **For agentic workers:** REQUIRED SUB-SKILL: Use the qskill-executing-plans skill to implement this plan task-by-task. Steps use checkbox tracking.
> Kế hoạch chỉ mô tả file, unit, hành vi, quy tắc, đầu ra và test cases; không có implementation code hoặc signatures. Đọc source thật trước mỗi task.
> **Gate:** Không execute kế hoạch khi trạng thái còn DRAFT hoặc khi blocker/dependency chưa giải quyết. Việc tạo file này không phê duyệt backlog hay P6.2.

**Mục tiêu:** Member join bằng PIN: WAITING membership canonical và cached room/member metadata.

**Slice:** SL-014. **Ưu tiên đề xuất:** P0. **Release:** MVP + activation/Premium; post-MVP deferred. SL-036 chỉ được tính release sau D6.

**Trạng thái kế hoạch:** APPROVED — human duyệt scope triển khai và architecture Spark ngày 2026-10-20.
**Trạng thái implementation quan sát:** Join form, client repository transaction, SQLite projection và Rules đã được triển khai trong working tree ngày 2026-10-20. Emulator và app automated checks đã chạy; UI thực tế trên Expo Go vẫn cần human xác nhận.
**Baseline khảo sát:** docs/p6.0-implementation-slices tại 57ca1eb28a2952c66d01f89b9b89bf755ab4812a.
**Ngày soạn:** 2026-10-13, Asia/Saigon.
**Plan slug:** `2026-10-13-sl-014-room-join-pin`; mọi commit thực hiện plan này phải bắt đầu `[2026-10-13-sl-014-room-join-pin]`.
**Đầu vào phạm vi:** Backlog P6.0 v0.1; scope SL-014 được human yêu cầu triển khai và duyệt trong hội thoại ngày 2026-10-20.
**Traceability:** US-07; API §3; ADR-004; V05.
**Phụ thuộc bắt buộc:** [SL-013](./2026-10-13-sl-013-room-create.md)
**Ưu tiên mềm:** Theo thứ tự đề xuất trong [mục lục](../../implementation-plan.md); thứ tự không tạo thêm hard dependency.

## 1. Nguồn và ranh giới

Đọc [PRD](../../product-requirements.md), [Feature Spec](../../feature-specification.md), [Product Design](../../product-design.md), [Design Brief](../../product-design-brief.md), [Architecture](../../software-architecture.md), [API contracts](../../api-contracts.md), ADR áp dụng trong [decisions](../../decisions), cùng AGENTS ở app root. Tham chiếu cụ thể của slice nằm trong Traceability phía trên.

V01–V10 chỉ các màn tương ứng tại `design/concepts/concept-final/screens/`; prototype nằm tại `prototype/`. Chúng là read-only visual/interaction references, không chứng minh integration. Nếu journey không có design screen, trình bày gap với human trước quyết định UI mới.

**Kiến trúc:** joinRoomByPin sở hữu hành vi của slice. Presentation đọc kết quả qua controller/repository; không tự trở thành nguồn authoritative. Units và đường dẫn mới bên dưới là đề xuất, chưa tồn tại trên baseline; nếu prerequisite đã tạo cùng trách nhiệm thì reuse, không thêm convention thứ hai.

**Stack:** Expo SDK 57 / React Native / TypeScript. Firebase JS SDK Auth/Firestore trong Expo Go; join dùng Firestore client transaction guarded by Rules theo ADR-012, không triển khai Functions. SQLite cache chỉ ghi sau commit. Join là thao tác online.

**Không gồm:** Camera QR, roster realtime, bypass capacity bằng Local Premium.

## 2. Blocker, risk và quyết định cần duyệt

- **Resolved 2026-10-20:** Không dùng Cloud Function để giữ Firebase Spark. Client đọc trực tiếp reservation theo PIN và thực hiện membership/count/receipt trong một Firestore transaction được Rules kiểm soát.
- **Resolved 2026-10-20:** PIN mới có đúng tám chữ số; lời mời legacy bốn số vẫn được nhận để giữ các phòng đã tạo trước khi đổi contract.

**Rủi ro cụ thể:** Concurrent capacity và query-compatible Rules. Firestore Rules không thể rate-limit document reads; tám chữ số giảm xác suất đoán nhưng không ngăn enumeration tuyệt đối. Authenticated direct get được mở riêng cho `roomPins/{pin}`, collection listing vẫn bị deny.

Nếu một contract chỉ có responsibility mà chưa có schema, task đầu là trình bày missing decision với nguồn; không tự tạo endpoint/field mới. Các hành vi test bên dưới mô tả outcome cần đạt, không thay thế wire approval. Ngưỡng/range/default chưa được spec xác định phải có quyết định ghi lại trước khi implement.

## 3. File và quyền sở hữu dự kiến

Các đường dẫn sau tương đối với `dontlift-mobile/`. Đọc lại trạng thái file lúc execute để chọn Create/Modify; không ghi đè implementation của dependency.

| File dự kiến | Trách nhiệm |
|---|---|
| `src/features/rooms/room-command-port.ts` | Unit/repository/adapter chuyên trách; reuse nếu prerequisite đã tạo. |
| `src/features/rooms/room-repository.ts` | Unit/repository/adapter chuyên trách; reuse nếu prerequisite đã tạo. |
| `src/screens/JoinRoomScreen.tsx` | Presentation và states của journey; không chứa domain math/sync authority. |
| `src/app/index.tsx` | Đăng ký JoinRoom screen state và render trong app flow hiện tại. |
| `src/types.ts` | Thêm ScreenId cho hành trình join PIN. |
| `src/constants.ts` | Thêm screen title theo ScreenId. |
| `src/screens/GroupLobbyScreen.tsx` | Thêm user-facing “join with PIN” entry từ Group tab/lobby; không dựa vào prototype Control Deck. |
| `__tests__/room-join-pin.test.ts` | Kiểm thử dự kiến; chưa tạo test source trong P6.1. |
| `__tests__/room-join-pin-navigation.test.ts` | Kiểm chứng Group entry mở JoinRoom state và quay lại được khi cancel/error. |
| `functions/tests/room-join-pin.rules.emulator.test.cjs` | Kiểm thử Firestore Rules bằng Emulator Suite. |

**Unit:** joinRoomByPin.
**Nhận:** Current Auth UID, PIN mới tám chữ số hoặc PIN legacy bốn chữ số, và UUID requestId.
**Trả:** WAITING membership canonical và cached room/member metadata.
**Đầu vào từ dependency:** capabilities/records/commands đã nghiệm thu theo các plan liên kết; chưa có dependency output thì không giả coi integration có thật.
**Đầu ra cho slice sau:** outcome và invariants trong mục tiêu/nghiệm thu dưới đây; tên internal unit là đề xuất, wire names chỉ dùng theo API/ADR đã duyệt.

### Contract dữ liệu đã có

Bảng dưới là trích ranh giới từ API đã duyệt, không tạo schema mới. Common response giữ version/requestId/serverTimeUtcMs khi contract yêu cầu; full required fields/errors/transaction outputs vẫn theo API section được tham chiếu.

| Field | Bắt buộc / hướng | Quy tắc |
|---|---|---|
| version | Bắt buộc | 1, theo common envelope. |
| requestId | Bắt buộc | UUID; cùng actor/payload replay trả prior outcome, payload khác bị collision. |
| pin | Bắt buộc | PIN mới tám chữ số; PIN legacy bốn chữ số vẫn được nhận. |

## 4. Ràng buộc xuyên suốt

- Giữ approved architecture; newer human decisions và accepted ADR exceptions thắng prose cũ.
- Không sao chép Firebase token vào SQLite, AsyncStorage hoặc SecureStore; SDK quản lý session.
- Event offline-capable dùng SQLite domain record và sync_outbox trong một transaction; syncEvents là ingestion authority.
- Command lifecycle/vote/bill/payment không queue để replay muộn. Firestore cache không thay thế outbox.
- Membership authority là rooms/{roomId}/members/{uid}. SL-014 derives actor from Firebase Auth; Firestore Rules authorize client transactions; slice này không dùng Functions/Admin SDK.
- Giữ 3-Second Grace Period ở cả foreground/background theo ADR-008.
- Local Premium không cấp server quota/capacity; chỉ verified Server Premium cấp server benefits.
- Bill dùng integer VND, deterministic residual và tổng exact theo ADR-005; VietQR non-custodial, không bank polling.
- UI dùng semantic tokens và accepted Liquid Acrylic; loading/empty/error/offline/syncing, labels, safe areas và touch targets được kiểm chứng khi phù hợp.
- Không thêm social login, analytics dashboards, kiosk, wallet, chat, AI coaching hoặc camera-based detection vào MVP.
- Không install/provision/deploy/publish trong lượt authoring plan này; mọi check bên dưới là hướng dẫn execution sau approval.

## 5. Các task thực hiện sau approval

### Task 1 — Boundary và quy tắc của Member join bằng PIN

**Files:** Dùng units/config/backend/repositories trong bảng mục 3; khi test source đã được chỉ định, đặt cases thuộc boundary vào đúng app/backend target. Không thay presentation chưa cần cho task này.

**Nhận/trả:** Nhận Current Auth UID, PIN mới tám chữ số hoặc legacy bốn chữ số, và requestId; trả WAITING membership canonical và cached room/member metadata. ADR-012 đã duyệt contract Spark.

- [ ] Viết focused failing cases sau đây; runner không tìm thấy hoặc thiếu dependency không được tính là red nghiệp vụ.

- [x] Valid WAITING PIN → membership một lần (Firestore Rules Emulator + repository unit test).
- [x] PIN sai/expired → safe not-found (repository unit test với reservation không tồn tại).
- [x] Room ACTIVE → failed-precondition (repository unit test; Rules emulator từ chối write).

- [ ] Chạy focused command trong mục 7; xác nhận failure đúng behavior đang thiếu, không từ toolchain lỗi.
- [ ] Xây hành vi theo thứ tự sau, chỉ sau approval:

1. Validate PIN trước network; đọc đúng document reservation theo PIN, không query/list collection.
2. Client transaction đọc room/membership; Rules kiểm tra WAITING và verified Host entitlement/capacity; Free tối đa 5 participants gồm Host.
3. Membership/count/receipt atomically; đã là Member thì không duplicate và không tăng count.

- [x] Chạy lại focused cases; không tuyên bố native/integration PASS từ mock.
- [ ] Review task và commit chỉ files thuộc task nếu execution được phép. Subject dùng `[2026-10-13-sl-014-room-join-pin]`, trailer `Plan: docs/superpowers/plans/2026-10-13-sl-014-room-join-pin.md` và `Task: 1`.

### Task 2 — Journey tích hợp và recovery

**Files:** Presentation/adapter/evidence trong mục 3 cùng boundary task 1; không refactor screen không liên quan. Task này không tạo implementation thứ hai cho unit task 1.

**Nhận:** Output task 1 đã kiểm chứng. **Trả:** Journey/bằng chứng có thể nghiệm thu; error/offline không false-success.

- [ ] Viết các failing cases về integration/recovery sau; không viết tests chỉ mirror implementation.

- [x] Free room có 5 → join bị chặn (Rules Emulator).
- [x] Hai người tranh slot cuối → chỉ một join (Rules Emulator).
- [x] Retry user đã Member → count không tăng (Rules Emulator).

- [ ] Chạy focused checks, xác nhận failure đúng behavior; giữ fixtures tách khỏi device evidence.
- [ ] Tích hợp theo thứ tự:

1. Invalid/expired trả safe error không room internals; full room hiển thị lý do.
2. Local cache write failure sau join giữ recovery route, không gửi join với payload khác ngẫu nhiên.
3. Offline join không queue; form giữ PIN khi retry service failure.
4. Group tab/lobby exposes Join with PIN action; action opens JoinRoomScreen via registered app state, and Back/Cancel returns to Group without invoking join.

- [ ] Thực hiện các kịch bản nghiệm thu trực tiếp trong mục 6; thu logs an toàn/device timestamps khi cần.
- [ ] Review kết quả; một branch fail hoặc thiếu required device/emulator evidence thì slice chưa hoàn thành.
- [ ] Commit task sau review nếu execution được phép. Subject dùng `[2026-10-13-sl-014-room-join-pin]`, trailer `Plan: docs/superpowers/plans/2026-10-13-sl-014-room-join-pin.md` và `Task: 2`.

## 6. Nghiệm thu và failure outcomes

- [ ] Valid WAITING PIN → membership một lần.
- [ ] PIN sai/expired → safe not-found.
- [ ] Room ACTIVE → failed-precondition.
- [ ] Free room có 5 → join bị chặn.
- [ ] Hai người tranh slot cuối → chỉ một join.
- [ ] Scan/retry user đã Member → count không tăng.
- [ ] Group tab/lobby có Join with PIN action → mở JoinRoomScreen; cancel/back quay lại Group, không gọi backend.
- [ ] Hai user emulators join cùng room → memberships canonical.
- [ ] Anonymous/cross-room writes thử trực tiếp → deny bằng Rules.

Mỗi case phải có actual result. Unit cases dùng controlled fixtures để chứng minh domain; Firebase boundary cần Rules/Functions emulator tests cho allowed/denied/replay/concurrency khi áp dụng. Sensor/lifecycle cần physical devices. Không có evidence thì ghi UNVERIFIED và blocker, không tick PASS.

**Failure recovery bắt buộc:** không hiển thị successful save/transition khi commit/request chưa thành công; giữ dữ liệu/retry context theo hành vi cụ thể trong tasks. Không log email đầy đủ, token, activation code hoặc bank details. Case không áp dụng cho slice phải ghi lý do trong evidence, không bỏ im lặng.

## 7. Verification và ghi nhận evidence

App focused tests: `pnpm test --runTestsByPath __tests__/room-join-pin.test.ts __tests__/room-join-pin-navigation.test.ts`. Firestore Rules emulator: `node --test functions/tests/room-join-pin.rules.emulator.test.cjs functions/tests/room-create.rules.emulator.test.cjs` using the existing emulator config. TypeScript: `pnpm exec tsc --noEmit`. Lint: `pnpm run lint` chỉ khi repository có ESLint setup thực tế.

Evidence 2026-10-20, working tree trên `feature/sl-014-join-room-by-pin`:

- `node_modules/.bin/tsc.cmd --noEmit` — PASS.
- `node_modules/.bin/jest.cmd --runInBand` — PASS, 21 suites / 156 tests.
- Firestore Emulator Standard, project `demo-dontlift-expo-go`, `node --test functions/tests/room-create.rules.emulator.test.cjs functions/tests/room-join-pin.rules.emulator.test.cjs` — PASS, 10 tests.
- `expo lint` — UNAVAILABLE: chưa có ESLint config; Expo thử cấu hình và bị chặn do network access.
- Expo Go physical UI flow — NOT YET VERIFIED; cần mở Group, join PIN 8 số và thử PIN legacy 4 số trên thiết bị thật.
- Không deploy Firestore Rules hoặc Cloud Functions; không bật billing.

## 8. Human review và bàn giao P6.2

Human đã duyệt scope, non-goals, tasks, acceptance cases, dependency SL-013, Spark direct lookup, tám chữ số mới và residual enumeration risk ngày 2026-10-20. Duyệt một slice không duyệt tất cả 37; duyệt authoring batch không duyệt code.

Sau approval, cập nhật trạng thái/date/decision evidence trong đúng plan; kế hoạch mới chỉ đủ execution-ready khi blocker đã được giải quyết và baseline được re-inspect. Dùng qskill-executing-plans khi user yêu cầu execute plan đã duyệt. Không tự bắt đầu P6.2 từ file draft hoặc từ prompt batch.
