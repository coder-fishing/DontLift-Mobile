# Kế hoạch triển khai P6.1 — SL-036: Advanced leaderboard theo Server Premium

> **For agentic workers:** REQUIRED SUB-SKILL: Use the qskill-executing-plans skill to implement this plan task-by-task. Steps use checkbox tracking.
> Kế hoạch chỉ mô tả file, unit, hành vi, quy tắc, đầu ra và test cases; không có implementation code hoặc signatures. Đọc source thật trước mỗi task.
> **Gate:** Không execute kế hoạch khi trạng thái còn DRAFT hoặc khi blocker/dependency chưa giải quyết. Việc tạo file này không phê duyệt backlog hay P6.2.

**Mục tiêu:** Advanced leaderboard theo Server Premium: Behavior chốt với human; read model/gates được kiểm chứng, không analytics tự thêm.

**Slice:** SL-036. **Ưu tiên đề xuất:** P2. **Release:** MVP + activation/Premium; post-MVP deferred. SL-036 chỉ được tính release sau D6.

**Trạng thái kế hoạch:** DRAFT — chưa được human duyệt; bị chặn bởi D6.
**Trạng thái implementation quan sát:** Chưa có behavior/acceptance đủ chi tiết. Chưa có evidence nghiệm thu slice.
**Baseline khảo sát:** docs/p6.0-implementation-slices tại 57ca1eb28a2952c66d01f89b9b89bf755ab4812a.
**Ngày soạn:** 2026-10-13, Asia/Saigon.
**Plan slug:** `2026-10-13-sl-036-advanced-leaderboard`; mọi commit thực hiện plan này phải bắt đầu `[2026-10-13-sl-036-advanced-leaderboard]`.
**Đầu vào phạm vi:** Backlog P6.0 v0.1 trong cuộc trò chuyện ngày 2026-10-13, chưa được phê duyệt. User đã yêu cầu ghi draft P6.1 cho cả 37 slice; không suy thành approval thực thi.
**Traceability:** PRD §8.3; ADR-007; V06.
**Phụ thuộc bắt buộc:** [SL-017](./2026-10-13-sl-017-group-active.md), [SL-032](./2026-10-13-sl-032-server-premium.md)
**Ưu tiên mềm:** Theo thứ tự đề xuất trong [mục lục](../../implementation-plan.md); thứ tự không tạo thêm hard dependency.

## 1. Nguồn và ranh giới

Đọc [PRD](../../product-requirements.md), [Feature Spec](../../feature-specification.md), [Product Design](../../product-design.md), [Design Brief](../../product-design-brief.md), [Architecture](../../software-architecture.md), [API contracts](../../api-contracts.md), ADR áp dụng trong [decisions](../../decisions), cùng AGENTS ở app root. Tham chiếu cụ thể của slice nằm trong Traceability phía trên.

V01–V10 chỉ các màn tương ứng tại `design/concepts/concept-final/screens/`; prototype nằm tại `prototype/`. Chúng là read-only visual/interaction references, không chứng minh integration. Nếu journey không có design screen, trình bày gap với human trước quyết định UI mới.

**Kiến trúc:** advanced leaderboard boundary sở hữu hành vi của slice. Presentation đọc kết quả qua controller/repository; không tự trở thành nguồn authoritative. Units và đường dẫn mới bên dưới là đề xuất, chưa tồn tại trên baseline; nếu prerequisite đã tạo cùng trách nhiệm thì reuse, không thêm convention thứ hai.

**Stack:** Expo SDK 57 / React Native / TypeScript. SQLite cho local-first khi slice có persistence; React Native Firebase Auth/Firestore Standard/Functions cho boundary có Firebase. Không bắt slice thuần local phải có network.

**Không gồm:** Analytics dashboards, export/insights hoặc post-MVP gamification chưa accepted.

## 2. Blocker, risk và quyết định cần duyệt

- **D6:** Duyệt theme catalog/default/downgrade và behavior advanced leaderboard; analytics nâng cao vẫn deferred.

**Rủi ro cụ thể:** D6; đây là plan quyết định-scope bị chặn, không implementation plan hoàn chỉnh có thể execute.

Nếu một contract chỉ có responsibility mà chưa có schema, task đầu là trình bày missing decision với nguồn; không tự tạo endpoint/field mới. Các hành vi test bên dưới mô tả outcome cần đạt, không thay thế wire approval. Ngưỡng/range/default chưa được spec xác định phải có quyết định ghi lại trước khi implement.

## 3. File và quyền sở hữu dự kiến

Các đường dẫn sau tương đối với `dontlift-mobile/`. Đọc lại trạng thái file lúc execute để chọn Create/Modify; không ghi đè implementation của dependency.

| File dự kiến | Trách nhiệm |
|---|---|
| `firestore.emulator.rules` | SL-036 chỉ mở rộng nếu decision D6 duyệt resource/query mới; nếu dùng leaderboard projection SL-017 thì reuse policy, không tạo quyền trùng. |
| `functions/tests/advanced-leaderboard-rules.emulator.test.cjs` | Client-SDK Emulator Suite tests cho audience/Server Premium access theo D6; outsider và client writes luôn bị deny. |
| `src/features/rooms/leaderboard-controller.ts` | Unit/repository/adapter chuyên trách; reuse nếu prerequisite đã tạo. |
| `src/screens/GroupActiveScreen.tsx` | Presentation và states của journey; không chứa domain math/sync authority. |

**Unit:** advanced leaderboard boundary.
**Nhận:** Approved advanced MVP behavior và verified server entitlement.
**Trả:** Behavior chốt với human; read model/gates được kiểm chứng, không analytics tự thêm.
**Đầu vào từ dependency:** capabilities/records/commands đã nghiệm thu theo các plan liên kết; chưa có dependency output thì không giả coi integration có thật.
**Đầu ra cho slice sau:** outcome và invariants trong mục tiêu/nghiệm thu dưới đây; tên internal unit là đề xuất, wire names chỉ dùng theo API/ADR đã duyệt.

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

### Task 0 — Rules cho advanced leaderboard theo contract D6

**Files:** Chỉ khi D6 xác nhận read model/resource mới: `firestore.emulator.rules`, `functions/tests/advanced-leaderboard-rules.emulator.test.cjs`. Nếu SL-036 đọc projection đã có, kế thừa Rules/tests SL-017.

- [ ] Không chọn collection, query, entitlement check hay audience trước khi D6 chốt behavior và contract.
- [ ] Với resource mới được duyệt, client-SDK Emulator Suite kiểm tra đúng Server Premium/member audience, Free/Local-only denial theo decision, outsider/cross-room denial và query constraints.
- [ ] Deny client create/update/delete leaderboard aggregate; chỉ backend được ghi authoritative projection.
- [ ] Nếu không có resource mới, ghi evidence reuse SL-017 policy/tests; SL-037 re-test policy canonical.

### Task 1 — Xác nhận đầu vào và gate nghiệp vụ

**Files:** Dùng units/config/backend/repositories trong bảng mục 3; khi test source đã được chỉ định, đặt cases thuộc boundary vào đúng app/backend target. Không thay presentation chưa cần cho task này.

**Nhận/trả:** Nhận Approved advanced MVP behavior và verified server entitlement; trả Behavior chốt với human; read model/gates được kiểm chứng, không analytics tự thêm. Với contract đang bị chặn, chưa có quyền thêm schema dù test outcome đã được nêu.

- [ ] Đọc lại source/spec và xác nhận tất cả blocker cùng dependency cho task đã được giải quyết; nếu chưa, dừng execution và báo đúng blocker.
- [ ] Kiểm chứng gate bằng evidence/decision đã duyệt; không viết implementation test giả.

- [ ] Chưa có D6 approval → không thể chuyển plan sang Approved.
- [ ] Local Premium nhưng server Free → không tự granted server feature.
- [ ] Outsider → không đọc room data dù Premium.

- [ ] Đối chiếu từng case với approval/evidence, ghi gap trước khi tiến hành.
- [ ] Xây hành vi theo thứ tự sau, chỉ sau approval:

1. Human xác định khác biệt measurable của basic/advanced và người nào hưởng quyền.
2. Giữ basic leaderboard SL-017; server authority không dựa Local Premium.
3. Chỉ sau decision mới chốt fields/query/API/tests; không tự thêm export/insights.

- [ ] Chạy lại các cases và đối chiếu output/invariants; không tuyên bố native/integration PASS từ mock.
- [ ] Review task và commit chỉ files thuộc task nếu execution được phép. Subject dùng `[2026-10-13-sl-036-advanced-leaderboard]`, trailer `Plan: docs/superpowers/plans/2026-10-13-sl-036-advanced-leaderboard.md` và `Task: 1`.

### Task 2 — Hoàn tất review và bằng chứng

**Files:** Presentation/adapter/evidence trong mục 3 cùng boundary task 1; không refactor screen không liên quan. Task này không tạo implementation thứ hai cho unit task 1.

**Nhận:** Output task 1 đã kiểm chứng. **Trả:** Journey/bằng chứng có thể nghiệm thu; error/offline không false-success.

- [ ] Chuẩn bị checklist review/smoke từ evidence thật; unresolved scope vẫn giữ DRAFT/BLOCKED.

- [ ] Basic leaderboard → vẫn hoạt động khi feature blocked.
- [ ] Field/query/schema mới → phải có contract approval trước implementation.
- [ ] Advanced leaderboard read theo D6 audience → allowed; Free/unauthorized/outsider/cross-room → denied theo decision; client aggregate writes → denied.

- [ ] Chỉ chạy check được authorized và có runtime; nếu chưa có, ghi missing evidence.
- [ ] Tích hợp theo thứ tự:

1. Review states/accessibility cho behavior đã duyệt; ghi allowed/denied outcome rõ.
2. Nếu advanced được defer, record decision và không đặt feature này thành release prerequisite.
3. Không chấp nhận tên advanced là acceptance hoàn chỉnh.

- [ ] Thực hiện các kịch bản nghiệm thu trực tiếp trong mục 6; thu logs an toàn/device timestamps khi cần.
- [ ] Review kết quả; một branch fail hoặc thiếu required device/emulator evidence thì slice chưa hoàn thành.
- [ ] Commit task sau review nếu execution được phép. Subject dùng `[2026-10-13-sl-036-advanced-leaderboard]`, trailer `Plan: docs/superpowers/plans/2026-10-13-sl-036-advanced-leaderboard.md` và `Task: 2`.

## 6. Nghiệm thu và failure outcomes

- [ ] Chưa có D6 approval → không thể chuyển plan sang Approved.
- [ ] Local Premium nhưng server Free → không tự granted server feature.
- [ ] Outsider → không đọc room data dù Premium.
- [ ] Basic leaderboard → vẫn hoạt động khi feature blocked.
- [ ] Field/query/schema mới → phải có contract approval trước implementation.
- [ ] Human review behavior comparison basic/advanced → scope và acceptance chốt.
- [ ] Device scenario chỉ được viết chi tiết sau approved behavior; hiện chưa execution-ready.

Mỗi case phải có actual result. Unit cases dùng controlled fixtures để chứng minh domain; Firebase boundary cần Rules/Functions emulator tests cho allowed/denied/replay/concurrency khi áp dụng. Sensor/lifecycle cần physical devices. Không có evidence thì ghi UNVERIFIED và blocker, không tick PASS.

**Failure recovery bắt buộc:** không hiển thị successful save/transition khi commit/request chưa thành công; giữ dữ liệu/retry context theo hành vi cụ thể trong tasks. Không log email đầy đủ, token, activation code hoặc bank details. Case không áp dụng cho slice phải ghi lý do trong evidence, không bỏ im lặng.

## 7. Verification và ghi nhận evidence

Chưa chỉ định test source hoặc command cho behavior chưa được duyệt. Gate đầu tiên kiểm tra có decision/acceptance rõ trước khi thêm tests.

Lệnh app chạy từ `dontlift-mobile/`; file paths tests/backend ở trên là planned targets. Command chỉ được chạy sau harness/dependency prerequisites. Native build/emulator commands phải lấy từ cấu hình thật sau SL-002; không đoán project ID, runtime hoặc production alias. Future schema/index changes được test với approved edition Standard.

Ghi trong kết quả execution: baseline/commit mới, command, exit status, số cases, emulator/device/runtime version, date, actual outcomes và remaining gaps. Các checklist hiện đều chưa chạy.

## 8. Human review và bàn giao P6.2

Human phải duyệt scope, non-goals, tasks, acceptance cases, dependencies và các quyết định còn mở của **SL-036** trước implementation. Duyệt một slice không duyệt tất cả 37; duyệt authoring batch không duyệt code.

Sau approval, cập nhật trạng thái/date/decision evidence trong đúng plan; kế hoạch mới chỉ đủ execution-ready khi blocker đã được giải quyết và baseline được re-inspect. Dùng qskill-executing-plans khi user yêu cầu execute plan đã duyệt. Không tự bắt đầu P6.2 từ file draft hoặc từ prompt batch.
