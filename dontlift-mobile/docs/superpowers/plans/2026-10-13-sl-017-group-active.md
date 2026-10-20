# Kế hoạch triển khai P6.1 — SL-017: Group active, capture và leaderboard

> **For agentic workers:** REQUIRED SUB-SKILL: Use the qskill-executing-plans skill to implement this plan task-by-task. Steps use checkbox tracking.
> Kế hoạch chỉ mô tả file, unit, hành vi, quy tắc, đầu ra và test cases; không có implementation code hoặc signatures. Đọc source thật trước mỗi task.
> **Gate:** Chỉ execute sau human approval và khi blocker/dependency của slice đã được giải quyết. Approval SL-017 bên dưới chỉ áp dụng slice này.

**Mục tiêu:** Group active, capture và leaderboard: Local group capture và authorized realtime Penalty Leaderboard.

**Slice:** SL-017. **Ưu tiên đề xuất:** P0. **Release:** MVP + activation/Premium; post-MVP deferred. SL-036 chỉ được tính release sau D6.

**Trạng thái kế hoạch:** APPROVED FOR EXECUTION — human approved SL-017 Spark group-violation contract on 2026-10-20; D3 resolved for this slice by ADR-014. Early-exit, termination vote, heartbeat and completion reconciliation remain with their owning slices.
**Trạng thái implementation:** Code đã được triển khai trên `feature/sl-017-group-active`; automated app checks pass. Firestore Emulator Rules và Expo Go/device acceptance còn UNVERIFIED.
**Baseline khảo sát:** `main` at merge PR #42 (`afe545d`), re-inspected 2026-10-20.
**Ngày soạn:** 2026-10-13, Asia/Saigon.
**Plan slug:** `2026-10-13-sl-017-group-active`; mọi commit thực hiện plan này phải bắt đầu `[2026-10-13-sl-017-group-active]`.
**Human approval:** User approved Spark transaction contract 2026-10-20: confirmed violation after ADR-008 grace period, immutable room event plus own-member aggregate increment in one Rules-checked transaction, event-ID replay safety, pending preservation for SL-020 reconciliation, no Functions/billing.
**Traceability:** US-09; FR-03; API §4; V06.
**Phụ thuộc bắt buộc:** [SL-016](./2026-10-13-sl-016-room-lobby-start.md), [SL-007](./2026-10-13-sl-007-foreground-detection.md), [SL-009](./2026-10-13-sl-009-android-recovery.md), [SL-010](./2026-10-13-sl-010-ios-recovery.md), [SL-011](./2026-10-13-sl-011-solo-sync.md)
**Ưu tiên mềm:** Theo thứ tự đề xuất trong [mục lục](../../implementation-plan.md); thứ tự không tạo thêm hard dependency.

## 1. Nguồn và ranh giới

Đọc [PRD](../../product-requirements.md), [Feature Spec](../../feature-specification.md), [Product Design](../../product-design.md), [Design Brief](../../product-design-brief.md), [Architecture](../../software-architecture.md), [API contracts](../../api-contracts.md), ADR áp dụng trong [decisions](../../decisions), cùng AGENTS ở app root. Tham chiếu cụ thể của slice nằm trong Traceability phía trên.

V01–V10 chỉ các màn tương ứng tại `design/concepts/concept-final/screens/`; prototype nằm tại `prototype/`. Chúng là read-only visual/interaction references, không chứng minh integration. Nếu journey không có design screen, trình bày gap với human trước quyết định UI mới.

**Kiến trúc:** group-session controller và group projection sở hữu hành vi của slice. Presentation đọc kết quả qua controller/repository; không tự trở thành nguồn authoritative. Units và đường dẫn mới bên dưới là đề xuất, chưa tồn tại trên baseline; nếu prerequisite đã tạo cùng trách nhiệm thì reuse, không thêm convention thứ hai.

**Stack:** Expo SDK 57 / React Native / TypeScript. SQLite/outbox owns offline group capture; authenticated Firebase JS client transaction plus Firestore Rules owns online group-violation writes on Spark. No Cloud Functions deployment or billing. Firestore Standard is configured by the existing project.

**Không gồm:** Early-exit, vote, score finalization, nudge feature không được đặc tả.

## 2. Blocker, risk và quyết định cần duyệt

- **D3:** Resolved for SL-017 group violation by ADR-014 and API §5.1. The transaction is online-only and accepts new events only while room/member are ACTIVE; preserve events that meet a later room window for SL-020 reconciliation. Early-exit, vote, heartbeat, and completion wire/concurrency decisions remain blockers in their own slices.

**Rủi ro cụ thể:** large-room listener/performance; device event timestamps require server-boundary checks. Events arriving after the room leaves ACTIVE stay pending for SL-020 reconciliation.

Nếu một contract chỉ có responsibility mà chưa có schema, task đầu là trình bày missing decision với nguồn; không tự tạo endpoint/field mới. Các hành vi test bên dưới mô tả outcome cần đạt, không thay thế wire approval. Ngưỡng/range/default chưa được spec xác định phải có quyết định ghi lại trước khi implement.

## 3. File và quyền sở hữu dự kiến

Các đường dẫn sau tương đối với `dontlift-mobile/`. Đọc lại trạng thái file lúc execute để chọn Create/Modify; không ghi đè implementation của dependency.

| File dự kiến | Trách nhiệm |
|---|---|
| `firestore.rules` | Same-room violation reads and the exact ADR-014 atomic event/own-member aggregate transaction; existing emulator config already points here. |
| `functions/tests/group-active-rules.emulator.test.cjs` | Client-SDK Emulator tests for membership, event/score atomicity, replay, timestamp window, outsider/cross-room denial and forbidden writes. |
| `src/features/rooms/group-session-controller.ts` | Reuse sensor/lifecycle ownership and expose group capture states; create only if no prerequisite already owns the behavior. |
| `src/features/rooms/group-projection-repository.ts` | Reconcile confirmed local group events with canonical room/member snapshots without deleting pending local events. |
| `src/features/rooms/group-violation-repository.ts` | Commit local group violation and outbox atomically; transmit each event with the ADR-014 online transaction and Rules error mapping. |
| `src/screens/GroupActiveScreen.tsx` | Presentation và states của journey; không chứa domain math/sync authority. |
| `__tests__/group-active.test.ts` | Kiểm thử dự kiến; chưa tạo test source trong P6.1. |

**Unit:** group-session controller và group projection.
**Nhận:** ACTIVE room, membership, sensor/lifecycle events và canonical server scores.
**Trả:** Local group capture và authorized realtime Penalty Leaderboard.
**Đầu vào từ dependency:** capabilities/records/commands đã nghiệm thu theo các plan liên kết; chưa có dependency output thì không giả coi integration có thật.
**Đầu ra cho slice sau:** outcome và invariants trong mục tiêu/nghiệm thu dưới đây; tên internal unit là đề xuất, wire names chỉ dùng theo API/ADR đã duyệt.

## 4. Ràng buộc xuyên suốt

- Giữ approved architecture; newer human decisions và accepted ADR exceptions thắng prose cũ.
- Không sao chép Firebase token vào SQLite, AsyncStorage hoặc SecureStore; SDK quản lý session.
- Confirmed group violations commit to SQLite and sync_outbox atomically, then use only the exact ADR-014 Spark transaction. Other offline events continue through syncEvents.
- Command lifecycle/vote/bill/payment không queue để replay muộn. Firestore cache không thay thế outbox.
- Membership authority là rooms/{roomId}/members/{uid}. SL-017 derives actor from Firebase Auth and Rules enforce the exact transaction; no Admin SDK or Cloud Functions path is used.
- Giữ 3-Second Grace Period ở cả foreground/background theo ADR-008.
- Local Premium không cấp server quota/capacity; chỉ verified Server Premium cấp server benefits.
- Bill dùng integer VND, deterministic residual và tổng exact theo ADR-005; VietQR non-custodial, không bank polling.
- UI dùng semantic tokens và accepted Liquid Acrylic; loading/empty/error/offline/syncing, labels, safe areas và touch targets được kiểm chứng khi phù hợp.
- Không thêm social login, analytics dashboards, kiosk, wallet, chat, AI coaching hoặc camera-based detection vào MVP.
- Không install/provision/deploy/publish trong execution này. Rules validation chỉ chạy Emulator Suite; production deploy cần yêu cầu riêng.

## 5. Các task execution đã được duyệt

### Task 0 — Rules cho violations và leaderboard trước client listener

**Files:** `firestore.rules`, `functions/tests/group-active-rules.emulator.test.cjs`. Reuse the existing emulator config/harness and room/member policy tested in SL-016. Emulator tests use client SDK contexts; production Rules are not deployed in this slice.

- [ ] Chỉ mở violation reads cho active Host/Member cùng room; outsider, anonymous và cross-room bị deny.
- [ ] Dùng client SDK để kiểm tra allowed member reads/listener, anonymous/outsider/cross-room denied, và query thực tế không trả dữ liệu ngoài room.
- [ ] Rules chỉ cho phép ADR-014 create immutable violation + exact own-member aggregate increment trong cùng transaction; deny standalone event writes, arbitrary score edits, updates to another member, event edits/deletes and unrelated room writes.
- [ ] Client-SDK Emulator cases verify event shape/time window, score formula, atomic linkage, duplicate replay and denial outcomes.
- [ ] Chạy lại room/member Rules regression; chưa deploy production Rules.

### Task 1 — Boundary và quy tắc của Group active, capture và leaderboard

**Files:** Dùng units/config/repositories trong bảng mục 3; đặt domain tests vào đúng app/backend target. Không thay presentation chưa cần cho task này.

**Nhận/trả:** Nhận ACTIVE room, membership, sensor/lifecycle events và canonical member scores; trả Local group capture và authorized realtime Penalty Leaderboard qua Spark transaction và listeners.

- [ ] Đọc lại source/spec và xác nhận tất cả blocker cùng dependency cho task đã được giải quyết; nếu chưa, dừng execution và báo đúng blocker.
- [ ] Viết focused failing cases sau đây; runner không tìm thấy hoặc thiếu dependency không được tính là red nghiệp vụ.

- [ ] User offline ACTIVE → local violation/outbox vẫn commit; không enqueue Firestore client transaction.
- [ ] Duplicate delivery → server score cộng một lần.
- [ ] Member gửi event user khác → permission-denied.
- [ ] Thành viên đọc violations/leaderboard trong room → allowed; outsider/cross-room → denied bằng Emulator Suite client SDK.
- [ ] Client arbitrary write violation/score/leaderboard → denied; exact atomic group event transaction → allowed.

- [ ] Chạy focused command trong mục 7; xác nhận failure đúng behavior đang thiếu, không từ toolchain lỗi.
- [ ] Xây hành vi theo thứ tự sau, theo contract đã được duyệt:

1. Reuse sensor/outbox/lifecycle owners; each event keeps room/user/session identity.
2. Apply ADR-014's exact UUID, room/member identity, confirmed interval and online Spark transaction after reading current room/member/event state.
3. Rules validates the atomic score delta from the immutable event; local pending preview stays distinct and must not be counted again when the listener snapshot arrives.

- [ ] Chạy lại các cases và đối chiếu output/invariants; không tuyên bố native/integration PASS từ mock.
- [ ] Review task và commit chỉ files thuộc task nếu execution được phép. Subject dùng `[2026-10-13-sl-017-group-active]`, trailer `Plan: docs/superpowers/plans/2026-10-13-sl-017-group-active.md` và `Task: 1`.

### Task 2 — Journey tích hợp và recovery

**Files:** Presentation/adapter/evidence trong mục 3 cùng boundary task 1; không refactor screen không liên quan. Task này không tạo implementation thứ hai cho unit task 1.

**Nhận:** Output task 1 đã kiểm chứng. **Trả:** Journey/bằng chứng có thể nghiệm thu; error/offline không false-success.

- [ ] Viết các failing cases về integration/recovery sau; không viết tests chỉ mirror implementation.

- [ ] Event ngoài session window → rejection rõ; nếu room đã completed thì event vẫn local PENDING cho SL-020.
- [ ] Snapshot không xóa pending local event.
- [ ] Hai members lift/duration khác → ranking theo score thật, ties stable by UID.

- [ ] Chạy focused checks, xác nhận failure đúng behavior; giữ fixtures tách khỏi device evidence.
- [ ] Tích hợp theo thứ tự:

1. Sort ascending Penalty Score, not lift count alone; UID ascending breaks ties.
2. Network drop still captures locally and UI reports pending/offline; when room stops being ACTIVE, preserve the event for SL-020 reconciliation instead of marking it permanently failed.
3. Đo leaderboard latency không quá 2 giây sau confirmed và synced violation; unmount/logout cleanup.

- [ ] Thực hiện các kịch bản nghiệm thu trực tiếp trong mục 6; thu logs an toàn/device timestamps khi cần.
- [ ] Review kết quả; một branch fail hoặc thiếu required device/emulator evidence thì slice chưa hoàn thành.
- [ ] Commit task sau review nếu execution được phép. Subject dùng `[2026-10-13-sl-017-group-active]`, trailer `Plan: docs/superpowers/plans/2026-10-13-sl-017-group-active.md` và `Task: 2`.

## 6. Nghiệm thu và failure outcomes

- [ ] User offline ACTIVE → local violation/outbox vẫn commit.
- [ ] Duplicate delivery → server score cộng một lần.
- [ ] Member gửi event user khác → permission-denied.
- [ ] Event ngoài session window → rejection rõ.
- [ ] Snapshot không xóa pending local event.
- [ ] Hai members lift/duration khác → ranking theo score thật.
- [ ] Hai devices, một mất mạng rồi reconnect → đúng capture/realtime.
- [ ] Measure timestamp evidence cho latency; không claim emulator-only sensor correctness.

Mỗi case phải có actual result. Unit cases dùng controlled fixtures để chứng minh domain; Firebase boundary cần Rules Emulator client-SDK tests cho allowed/denied/replay/concurrency. Sensor/lifecycle cần physical devices. Không có evidence thì ghi UNVERIFIED và blocker, không tick PASS.

**Failure recovery bắt buộc:** không hiển thị successful save/transition khi commit/request chưa thành công; giữ dữ liệu/retry context theo hành vi cụ thể trong tasks. Không log email đầy đủ, token, activation code hoặc bank details. Case không áp dụng cho slice phải ghi lý do trong evidence, không bỏ im lặng.

## 7. Verification và ghi nhận evidence

App focused tests: `pnpm test --runInBand __tests__/group-active.test.ts`. Rules Suite: `node --test tests/group-active-rules.emulator.test.cjs` through the Firestore Emulator from `functions/`. TypeScript: `pnpm exec tsc --noEmit`. Lint: `pnpm run lint` only if an ESLint config is available. Emulator validation must run before any Rules deployment; no Functions tests/deployment are required for the Spark transaction.

App commands run from `dontlift-mobile/`; Rules tests run from `dontlift-mobile/functions/`. Existing `firebase.emulator.json` points to canonical `firestore.rules`, demo project `demo-dontlift-expo-go`, and port 8080; no production alias is used. Native sensor/lifecycle evidence requires Expo Go/physical-device checks, not mocks alone.

Ghi trong kết quả execution: baseline/commit mới, command, exit status, số cases, emulator/device/runtime version, date, actual outcomes và remaining gaps. Các checklist hiện đều chưa chạy.

**Execution evidence 2026-10-20:** `pnpm test --runInBand` PASS (28 suites, 182 tests); `pnpm exec tsc --noEmit` PASS; `node --check tests/group-active-rules.emulator.test.cjs` PASS; `git diff --check` PASS. Firestore Emulator Rules suite UNVERIFIED: Firebase CLI could not spawn `java -version` because Java is not installed/on PATH. Expo Go physical-device sensor/background, two-device realtime, offline/reconnect and latency acceptance remain UNVERIFIED. No production Rules deploy, Cloud Functions deploy, billing change, commit, or push was performed.

## 8. Human review và bàn giao P6.2

Human approval recorded 2026-10-20 for SL-017 execution and the ADR-014 Spark transaction contract, including its offline-pending behavior and no-billing constraint. Approval is limited to this slice; it does not approve SL-018/019/020 or any other D3 decision.

Execution bắt đầu sau khi approval/decision evidence được ghi nhận phía trên và blocker SL-017 được giải quyết. Approval này không tự động duyệt P6.2 hay các slice khác.
