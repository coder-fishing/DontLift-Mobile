# Kế hoạch triển khai P6.1 — SL-008: Hoàn tất và xem Solo summary

> **For agentic workers:** REQUIRED SUB-SKILL: Use the qskill-executing-plans skill to implement this plan task-by-task. Steps use checkbox tracking.
> Kế hoạch chỉ mô tả file, unit, hành vi, quy tắc, đầu ra và test cases; không có implementation code hoặc signatures. Đọc source thật trước mỗi task.
> **Gate:** Không execute kế hoạch khi trạng thái còn DRAFT hoặc khi blocker/dependency chưa giải quyết. Việc tạo file này không phê duyệt backlog hay P6.2.

**Mục tiêu:** Hoàn tất và xem Solo summary: COMPLETED session cùng summary outbox; summary offline từ repository.

**Slice:** SL-008. **Ưu tiên đề xuất:** P0. **Release:** MVP + activation/Premium; post-MVP deferred. SL-036 chỉ được tính release sau D6.

**Trạng thái kế hoạch:** Human đã duyệt phạm vi SL-008 ngày 2026-10-18; implementation đang thực hiện trên nhánh riêng.
**Trạng thái implementation quan sát:** Completion, SQLite summary/outbox, màn tổng kết và test tự động đã triển khai. Test tương tác trực tiếp trên Expo Go còn chờ.
**Baseline khảo sát:** docs/p6.0-implementation-slices tại 57ca1eb28a2952c66d01f89b9b89bf755ab4812a.
**Ngày soạn:** 2026-10-13, Asia/Saigon.
**Plan slug:** `2026-10-13-sl-008-solo-completion`; mọi commit thực hiện plan này phải bắt đầu `[2026-10-13-sl-008-solo-completion]`.
**Đầu vào phạm vi:** Backlog P6.0 v0.1 trong cuộc trò chuyện ngày 2026-10-13, chưa được phê duyệt. User đã yêu cầu ghi draft P6.1 cho cả 37 slice; không suy thành approval thực thi.
**Traceability:** US-05; FS §4.1/5.1; ADR-002; V04.
**Phụ thuộc bắt buộc:** [SL-007](./2026-10-13-sl-007-foreground-detection.md)
**Ưu tiên mềm:** Theo thứ tự đề xuất trong [mục lục](../../implementation-plan.md); thứ tự không tạo thêm hard dependency.

## 1. Nguồn và ranh giới

Đọc [PRD](../../product-requirements.md), [Feature Spec](../../feature-specification.md), [Product Design](../../product-design.md), [Design Brief](../../product-design-brief.md), [Architecture](../../software-architecture.md), [API contracts](../../api-contracts.md), ADR áp dụng trong [decisions](../../decisions), cùng AGENTS ở app root. Tham chiếu cụ thể của slice nằm trong Traceability phía trên.

V01–V10 chỉ các màn tương ứng tại `design/concepts/concept-final/screens/`; prototype nằm tại `prototype/`. Chúng là read-only visual/interaction references, không chứng minh integration. Nếu journey không có design screen, trình bày gap với human trước quyết định UI mới.

**Kiến trúc:** Solo completion controller sở hữu hành vi của slice. Presentation đọc kết quả qua controller/repository; không tự trở thành nguồn authoritative. Units và đường dẫn mới bên dưới là đề xuất, chưa tồn tại trên baseline; nếu prerequisite đã tạo cùng trách nhiệm thì reuse, không thêm convention thứ hai.

**Stack:** Expo SDK 57 / React Native / TypeScript. SQLite cho local-first khi slice có persistence; React Native Firebase Auth/Firestore Standard/Functions cho boundary có Firebase. Không bắt slice thuần local phải có network.

**Không gồm:** Cloud delivery, history list, analytics hoặc share cards không có yêu cầu.

## 2. Blocker, risk và quyết định cần duyệt

- Không có blocker riêng được xác nhận trong draft; dependency và quyền/runtime vẫn phải đạt gate trước thực thi.

**Quyết định UX được human duyệt ngày 2026-10-18:** Kết thúc sớm hoàn tất session và lưu summary; `Cancel session` là hủy riêng, không tạo summary/thành tích. Session completed có thể chúc mừng khi không ghi nhận violation; so sánh tiến bộ với các session cũ và lời khen dựa trên tiến bộ thuộc history/progress scope sau này.

**Rủi ro cụ thể:** Completion cutoff và duration units phải đồng nhất engine/repository.

Nếu một contract chỉ có responsibility mà chưa có schema, task đầu là trình bày missing decision với nguồn; không tự tạo endpoint/field mới. Các hành vi test bên dưới mô tả outcome cần đạt, không thay thế wire approval. Ngưỡng/range/default chưa được spec xác định phải có quyết định ghi lại trước khi implement.

## 3. File và quyền sở hữu dự kiến

Các đường dẫn sau tương đối với `dontlift-mobile/`. Đọc lại trạng thái file lúc execute để chọn Create/Modify; không ghi đè implementation của dependency.

| File dự kiến | Trách nhiệm |
|---|---|
| `src/features/solo/session-controller.ts` | Unit/repository/adapter chuyên trách; reuse nếu prerequisite đã tạo. |
| `src/features/solo/summary-service.ts` | Unit/repository/adapter chuyên trách; reuse nếu prerequisite đã tạo. |
| `src/features/solo/local-session-repository.ts` | Unit/repository/adapter chuyên trách; reuse nếu prerequisite đã tạo. |
| `src/screens/SoloSummaryScreen.tsx` | Presentation và states của journey; không chứa domain math/sync authority. |
| `src/app/index.tsx` | Unit/repository/adapter chuyên trách; reuse nếu prerequisite đã tạo. |
| `__tests__/solo-completion.test.ts` | Kiểm thử dự kiến; chưa tạo test source trong P6.1. |

**Unit:** Solo completion controller.
**Nhận:** Active session, violations committed và completion time.
**Trả:** COMPLETED session cùng summary outbox; summary offline từ repository.
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

### Task 1 — Boundary và quy tắc của Hoàn tất và xem Solo summary

**Files:** Dùng units/config/backend/repositories trong bảng mục 3; khi test source đã được chỉ định, đặt cases thuộc boundary vào đúng app/backend target. Không thay presentation chưa cần cho task này.

**Nhận/trả:** Nhận Active session, violations committed và completion time; trả COMPLETED session cùng summary outbox; summary offline từ repository. Với contract đang bị chặn, chưa có quyền thêm schema dù test outcome đã được nêu.

- [x] Đọc lại source/spec và xác nhận dependency SL-007 cùng contract summary đã có.
- [x] Viết focused cases cho completion, cutoff, idempotency, rollback và summary offline.

- [x] Countdown hết giờ → complete một lần ở repository; Expo timer integration đã bundle.
- [x] Stopwatch user Stop → elapsed được lưu.
- [x] Stop và timer-zero cùng session → controller gộp request và repository idempotent.

- [x] Chạy test SL008 cùng full app suite.
- [x] Xây hành vi theo thứ tự sau:

1. Countdown zero hoặc user Stop mở completion; clamp thời lượng và đóng violation tại completion cutoff.
2. Tính duration, lift count, violation duration, Penalty Score từ persisted records.
3. Trong một transaction complete session và queue SOLO_SESSION_COMPLETED dùng session ID; duplicate completion trả cùng summary.

- [x] Chạy lại cases; kiểm tra Android bundle. Nghiệm thu tương tác Expo Go còn pending.
- [ ] Review task và commit chỉ files thuộc task nếu execution được phép. Subject dùng `[2026-10-13-sl-008-solo-completion]`, trailer `Plan: docs/superpowers/plans/2026-10-13-sl-008-solo-completion.md` và `Task: 1`.

### Task 2 — Journey tích hợp và recovery

**Files:** Presentation/adapter/evidence trong mục 3 cùng boundary task 1; không refactor screen không liên quan. Task này không tạo implementation thứ hai cho unit task 1.

**Nhận:** Output task 1 đã kiểm chứng. **Trả:** Journey/bằng chứng có thể nghiệm thu; error/offline không false-success.

- [x] Viết cases integration/recovery cho các outcome bên dưới.

- [x] Violation đang mở → kết thúc đúng cutoff.
- [x] Transaction fail → rollback cả completion và violation close trong repository transaction.
- [x] Không violation → score bằng không, summary vẫn đầy đủ.

- [x] Chạy focused checks; fixtures tách khỏi device evidence.
- [x] Tích hợp theo thứ tự:

1. Summary dùng số liệu SQLite thật, bỏ streak/log hardcoded; lỗi lưu không chuyển sang summary.
2. Stopwatch hoàn tất do user; Countdown tự hoàn tất tại zero; hủy riêng không tạo summary.
3. Summary đọc lại offline sau khi SQLite mở lại; session mới không xóa record completed.

- [ ] Thử trên Expo Go: finish sớm tạo summary, countdown zero tạo summary, cancel không tạo summary.
- [ ] Review kết quả; một branch fail hoặc thiếu required device/emulator evidence thì slice chưa hoàn thành.
- [ ] Commit task sau review nếu execution được phép. Subject dùng `[2026-10-13-sl-008-solo-completion]`, trailer `Plan: docs/superpowers/plans/2026-10-13-sl-008-solo-completion.md` và `Task: 2`.

## 6. Nghiệm thu và failure outcomes

- [x] Countdown hết giờ → completion idempotent.
- [x] Stopwatch user Stop → elapsed được lưu.
- [x] Stop và timer-zero cùng lúc → một summary/outbox.
- [x] Violation đang mở → kết thúc đúng cutoff.
- [x] Transaction fail → không có half-written summary.
- [x] Không violation → score bằng không, summary vẫn đầy đủ.
- [x] Offline hoàn tất → summary đọc từ SQLite ngay.
- [x] Mở SQLite lại sau completed/outbox cleanup → summary vẫn dựng lại giống.
- [ ] Expo Go trên Android: xác minh tương tác finish/cancel/auto-complete.

Mỗi case phải có actual result. Unit cases dùng controlled fixtures để chứng minh domain; Firebase boundary cần Rules/Functions emulator tests cho allowed/denied/replay/concurrency khi áp dụng. Sensor/lifecycle cần physical devices. Không có evidence thì ghi UNVERIFIED và blocker, không tick PASS.

**Failure recovery bắt buộc:** không hiển thị successful save/transition khi commit/request chưa thành công; giữ dữ liệu/retry context theo hành vi cụ thể trong tasks. Không log email đầy đủ, token, activation code hoặc bank details. Case không áp dụng cho slice phải ghi lý do trong evidence, không bỏ im lặng.

## 7. Verification và ghi nhận evidence

App test: `pnpm test -- --runInBand` → 11 suites, 91 tests PASS. Android bundle: `pnpm exec expo export --platform android --output-dir .expo/sl008-verify-final` → PASS. `git diff --check` → PASS.

TypeScript app/test source check bằng config tạm loại `.expo/types`: PASS. Lệnh chuẩn `pnpm exec tsc --noEmit` bị chặn bởi cú pháp không hợp lệ trong Expo-generated, git-ignored `.expo/types/router.d.ts`; không sửa file generated. Kiểm thử tương tác Expo Go còn UNVERIFIED. Không tạo commit theo yêu cầu human.

Lệnh app chạy từ `dontlift-mobile/`; file paths tests/backend ở trên là planned targets. Command chỉ được chạy sau harness/dependency prerequisites. Native build/emulator commands phải lấy từ cấu hình thật sau SL-002; không đoán project ID, runtime hoặc production alias. Future schema/index changes được test với approved edition Standard.

Ghi trong kết quả execution: baseline `10d43b2`, command, exit status, số cases, runtime version, date, actual outcomes và remaining gaps. TypeScript default và kiểm thử thiết bị còn gap như trên.

## 8. Human review và bàn giao P6.2

Human đã duyệt scope, non-goals, tasks và các quyết định UX của **SL-008** ngày 2026-10-18. Duyệt một slice không duyệt tất cả 37; duyệt authoring batch không duyệt code.

Sau approval, cập nhật trạng thái/date/decision evidence trong đúng plan; kế hoạch mới chỉ đủ execution-ready khi blocker đã được giải quyết và baseline được re-inspect. Dùng qskill-executing-plans khi user yêu cầu execute plan đã duyệt. Không tự bắt đầu P6.2 từ file draft hoặc từ prompt batch.
