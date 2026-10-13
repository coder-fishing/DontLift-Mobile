# Kế hoạch triển khai P6.1 — SL-031: Activation offline và Local Premium

> **For agentic workers:** REQUIRED SUB-SKILL: Use the qskill-executing-plans skill to implement this plan task-by-task. Steps use checkbox tracking.
> Kế hoạch chỉ mô tả file, unit, hành vi, quy tắc, đầu ra và test cases; không có implementation code hoặc signatures. Đọc source thật trước mỗi task.
> **Gate:** Không execute kế hoạch khi trạng thái còn DRAFT hoặc khi blocker/dependency chưa giải quyết. Việc tạo file này không phê duyệt backlog hay P6.2.

**Mục tiêu:** Activation offline và Local Premium: Local Premium persisted, code hash/verification state; full pending code ở SecureStore.

**Slice:** SL-031. **Ưu tiên đề xuất:** P1. **Release:** MVP + activation/Premium; post-MVP deferred. SL-036 chỉ được tính release sau D6.

**Trạng thái kế hoạch:** DRAFT — chưa được human duyệt; bị chặn bởi D5.
**Trạng thái implementation quan sát:** isPro mặc định true; activation chỉ đổi state. Chưa có evidence nghiệm thu slice.
**Baseline khảo sát:** docs/p6.0-implementation-slices tại 57ca1eb28a2952c66d01f89b9b89bf755ab4812a.
**Ngày soạn:** 2026-10-13, Asia/Saigon.
**Plan slug:** `2026-10-13-sl-031-local-premium`; mọi commit thực hiện plan này phải bắt đầu `[2026-10-13-sl-031-local-premium]`.
**Đầu vào phạm vi:** Backlog P6.0 v0.1 trong cuộc trò chuyện ngày 2026-10-13, chưa được phê duyệt. User đã yêu cầu ghi draft P6.1 cho cả 37 slice; không suy thành approval thực thi.
**Traceability:** US-19; ADR-007; V09.
**Phụ thuộc bắt buộc:** [SL-003](./2026-10-13-sl-003-registration-profile.md), [SL-004](./2026-10-13-sl-004-login-session.md)
**Ưu tiên mềm:** Theo thứ tự đề xuất trong [mục lục](../../implementation-plan.md); thứ tự không tạo thêm hard dependency.

## 1. Nguồn và ranh giới

Đọc [PRD](../../product-requirements.md), [Feature Spec](../../feature-specification.md), [Product Design](../../product-design.md), [Design Brief](../../product-design-brief.md), [Architecture](../../software-architecture.md), [API contracts](../../api-contracts.md), ADR áp dụng trong [decisions](../../decisions), cùng AGENTS ở app root. Tham chiếu cụ thể của slice nằm trong Traceability phía trên.

V01–V10 chỉ các màn tương ứng tại `design/concepts/concept-final/screens/`; prototype nằm tại `prototype/`. Chúng là read-only visual/interaction references, không chứng minh integration. Nếu journey không có design screen, trình bày gap với human trước quyết định UI mới.

**Kiến trúc:** offline activation controller sở hữu hành vi của slice. Presentation đọc kết quả qua controller/repository; không tự trở thành nguồn authoritative. Units và đường dẫn mới bên dưới là đề xuất, chưa tồn tại trên baseline; nếu prerequisite đã tạo cùng trách nhiệm thì reuse, không thêm convention thứ hai.

**Stack:** Expo SDK 57 / React Native / TypeScript. SQLite cho local-first khi slice có persistence; React Native Firebase Auth/Firestore Standard/Functions cho boundary có Firebase. Không bắt slice thuần local phải có network.

**Không gồm:** Purchase proof, unlimited server quota, code issuance/website/email implementation.

## 2. Blocker, risk và quyết định cần duyệt

- **D5:** Duyệt checksum cụ thể, test vectors, nguồn code hợp lệ và operational contract cấp code. Website/email mua Premium là external prerequisite, không tự implement.

**Rủi ro cụ thể:** D5; storage partial-failure ordering cần explicitly review, không giả claim Ed25519.

Nếu một contract chỉ có responsibility mà chưa có schema, task đầu là trình bày missing decision với nguồn; không tự tạo endpoint/field mới. Các hành vi test bên dưới mô tả outcome cần đạt, không thay thế wire approval. Ngưỡng/range/default chưa được spec xác định phải có quyết định ghi lại trước khi implement.

## 3. File và quyền sở hữu dự kiến

Các đường dẫn sau tương đối với `dontlift-mobile/`. Đọc lại trạng thái file lúc execute để chọn Create/Modify; không ghi đè implementation của dependency.

| File dự kiến | Trách nhiệm |
|---|---|
| `package.json` | SL-031 thêm `expo-secure-store` tương thích Expo SDK 57 sau khi kiểm tra compatibility tại thời điểm execution. |
| `package-lock.json` | SL-031 cập nhật cùng dependency graph bằng npm lockfile. |
| `pnpm-lock.yaml` | SL-031 cập nhật đồng bộ với npm lockfile theo AGENTS.md. |
| `app.json` | SL-031 sở hữu plugin/config nếu API/version SecureStore được chọn yêu cầu Expo config; xác nhận qua prebuild config, không thêm cấu hình không cần thiết. |
| `src/features/local/migrations.ts` | SL-031 mở rộng migration runner SL-003 bằng versioned entitlement schema theo architecture §6.3; không lưu full pending code hoặc Firebase token trong SQLite. |
| `src/features/premium/activation-validation.ts` | Unit/repository/adapter chuyên trách; reuse nếu prerequisite đã tạo. |
| `src/features/premium/entitlement-repository.ts` | Unit/repository/adapter chuyên trách; reuse nếu prerequisite đã tạo. |
| `src/features/premium/pending-code-store.ts` | Unit/repository/adapter chuyên trách; reuse nếu prerequisite đã tạo. |
| `src/screens/ActivationScreen.tsx` | Presentation và states của journey; không chứa domain math/sync authority. |
| `__tests__/local-premium.test.ts` | Kiểm thử dự kiến; chưa tạo test source trong P6.1. |

**Unit:** offline activation controller.
**Nhận:** Code format DONTLIFT-XXXX-XXXX-XXXX và accepted checksum/test vectors.
**Trả:** Local Premium persisted, code hash/verification state; full pending code ở SecureStore.
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

### Task 0 — SecureStore dependency và native configuration

**Files:** `package.json`, `package-lock.json`, `pnpm-lock.yaml`, và `app.json` nếu plugin/config được SDK yêu cầu.

- [ ] Xác nhận Expo SDK 57 compatibility rồi chọn package version bằng quy trình Expo-supported; không cài package trong P6.1 authoring.
- [ ] Giao SL-031 cập nhật package manifest cùng cả npm/pnpm lockfiles; kiểm tra lockfiles nhất quán và không đổi dependency ngoài phạm vi.
- [ ] Nếu native config plugin cần thiết, thêm và kiểm chứng đúng entry trong `app.json`; nếu không cần thì ghi rõ lý do trong evidence.
- [ ] Verify adapter trên iOS/Android Development Build; Expo Go/mock không chứng minh native SecureStore hoạt động.

### Task 1 — Boundary và quy tắc của Activation offline và Local Premium

**Files:** Dùng units/config/backend/repositories trong bảng mục 3; khi test source đã được chỉ định, đặt cases thuộc boundary vào đúng app/backend target. Không thay presentation chưa cần cho task này.

**Nhận/trả:** Nhận Code format DONTLIFT-XXXX-XXXX-XXXX và accepted checksum/test vectors; trả Local Premium persisted, code hash/verification state; full pending code ở SecureStore. Với contract đang bị chặn, chưa có quyền thêm schema dù test outcome đã được nêu.

- [ ] Đọc lại source/spec và xác nhận tất cả blocker cùng dependency cho task đã được giải quyết; nếu chưa, dừng execution và báo đúng blocker.
- [ ] Viết focused failing cases sau đây; runner không tìm thấy hoặc thiếu dependency không được tính là red nghiệp vụ.

- [ ] Malformed format → field error, entitlement không đổi.
- [ ] Checksum invalid → không Local Premium.
- [ ] Checksum valid → local flag/hash persisted.
- [ ] Fresh install → entitlement schema tồn tại sau migration trước repository write.
- [ ] Upgrade từ profile/session schema → entitlement migration được áp dụng, dữ liệu hiện có giữ nguyên.
- [ ] SecureStore save/read/remove thành công và pending code còn đọc được sau restart; plaintext không xuất hiện trong SQLite/logs.
- [ ] SecureStore unavailable hoặc read/write/remove reject → đúng retry/recovery outcome đã duyệt, không success giả và không mất pending code trước durable entitlement update.

- [ ] Chạy focused command trong mục 7; xác nhận failure đúng behavior đang thiếu, không từ toolchain lỗi.
- [ ] Xây hành vi theo thứ tự sau, chỉ sau approval:

1. Chốt checksum algorithm và valid/invalid vectors; không suy từ Ed25519 mock copy.
2. Database readiness áp dụng entitlement migration versioned sau các schema profile/session; giữ tách Local Premium và Server Premium theo ADR-007/architecture.
3. Format/checksum hợp lệ → Local Premium; không ghi Server Premium hoặc quota từ checksum.
4. Persist local flag/hash; full pending code tạm SecureStore, không token hay plain code SQLite.

- [ ] Chạy lại các cases và đối chiếu output/invariants; không tuyên bố native/integration PASS từ mock.
- [ ] Review task và commit chỉ files thuộc task nếu execution được phép. Subject dùng `[2026-10-13-sl-031-local-premium]`, trailer `Plan: docs/superpowers/plans/2026-10-13-sl-031-local-premium.md` và `Task: 1`.

### Task 2 — Journey tích hợp và recovery

**Files:** Presentation/adapter/evidence trong mục 3 cùng boundary task 1; không refactor screen không liên quan. Task này không tạo implementation thứ hai cho unit task 1.

**Nhận:** Output task 1 đã kiểm chứng. **Trả:** Journey/bằng chứng có thể nghiệm thu; error/offline không false-success.

- [ ] Viết các failing cases về integration/recovery sau; không viết tests chỉ mirror implementation.

- [ ] Offline activation → server flag không đổi.
- [ ] SQLite/SecureStore fail → không success giả, recovery state được duyệt.
- [ ] Restart → local benefits giữ, code không lọt logs.
- [ ] SecureStore save/read/remove failure được test riêng; recovery giữ đúng state theo D5/ADR-007 và không log code.

- [ ] Chạy focused checks, xác nhận failure đúng behavior; giữ fixtures tách khỏi device evidence.
- [ ] Tích hợp theo thứ tự:

1. Blank form/input/invalid/local-validated/pending-server states rõ, không mặc định Pro active.
2. Restart offline giữ Local Premium; server benefit chưa verified phải được giải thích.
3. Không claim purchase xác thực hoặc tất cả quyền mở ngay.

- [ ] Thực hiện các kịch bản nghiệm thu trực tiếp trong mục 6; thu logs an toàn/device timestamps khi cần.
- [ ] Review kết quả; một branch fail hoặc thiếu required device/emulator evidence thì slice chưa hoàn thành.
- [ ] Commit task sau review nếu execution được phép. Subject dùng `[2026-10-13-sl-031-local-premium]`, trailer `Plan: docs/superpowers/plans/2026-10-13-sl-031-local-premium.md` và `Task: 2`.

## 6. Nghiệm thu và failure outcomes

- [ ] Malformed format → field error, entitlement không đổi.
- [ ] Checksum invalid → không Local Premium.
- [ ] Checksum valid → local flag/hash persisted.
- [ ] Fresh install và upgrade từ profile/session schema → entitlement migration được áp dụng tuần tự mà không mất dữ liệu cũ.
- [ ] Offline activation → server flag không đổi.
- [ ] SQLite/SecureStore fail → không success giả, recovery state được duyệt.
- [ ] Restart → local benefits giữ, code không lọt logs.
- [ ] D5 vectors offline → đúng local flag và pending code storage.
- [ ] Local activation user thử create room vượt quota → server vẫn deny.

Mỗi case phải có actual result. Unit cases dùng controlled fixtures để chứng minh domain; Firebase boundary cần Rules/Functions emulator tests cho allowed/denied/replay/concurrency khi áp dụng. Sensor/lifecycle cần physical devices. Không có evidence thì ghi UNVERIFIED và blocker, không tick PASS.

**Failure recovery bắt buộc:** không hiển thị successful save/transition khi commit/request chưa thành công; giữ dữ liệu/retry context theo hành vi cụ thể trong tasks. Không log email đầy đủ, token, activation code hoặc bank details. Case không áp dụng cho slice phải ghi lý do trong evidence, không bỏ im lặng.

## 7. Verification và ghi nhận evidence

App focused tests sau khi SL-001 cấu hình runner: `pnpm test --runTestsByPath __tests__/local-premium.test.ts`. TypeScript: `pnpm exec tsc --noEmit`. Lint: `pnpm run lint` chỉ khi repository có ESLint setup thực tế.

Lệnh app chạy từ `dontlift-mobile/`; file paths tests/backend ở trên là planned targets. Command chỉ được chạy sau harness/dependency prerequisites. Native build/emulator commands phải lấy từ cấu hình thật sau SL-002; không đoán project ID, runtime hoặc production alias. Future schema/index changes được test với approved edition Standard.

Ghi trong kết quả execution: baseline/commit mới, command, exit status, số cases, emulator/device/runtime version, date, actual outcomes và remaining gaps. Các checklist hiện đều chưa chạy.

## 8. Human review và bàn giao P6.2

Human phải duyệt scope, non-goals, tasks, acceptance cases, dependencies và các quyết định còn mở của **SL-031** trước implementation. Duyệt một slice không duyệt tất cả 37; duyệt authoring batch không duyệt code.

Sau approval, cập nhật trạng thái/date/decision evidence trong đúng plan; kế hoạch mới chỉ đủ execution-ready khi blocker đã được giải quyết và baseline được re-inspect. Dùng qskill-executing-plans khi user yêu cầu execute plan đã duyệt. Không tự bắt đầu P6.2 từ file draft hoặc từ prompt batch.
