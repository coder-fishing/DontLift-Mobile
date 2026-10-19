# Kế hoạch triển khai P6.1 — SL-009: Android background và restart recovery

> **For agentic workers:** REQUIRED SUB-SKILL: Use the qskill-executing-plans skill to implement this plan task-by-task. Steps use checkbox tracking.
> Kế hoạch chỉ mô tả file, unit, hành vi, quy tắc, đầu ra và test cases; không có implementation code hoặc signatures. Đọc source thật trước mỗi task.
> **Gate:** Human duyệt triển khai giới hạn bằng Expo Go ngày 2026-10-18. Hành vi native đầy đủ vẫn UNVERIFIED và cần Development Build trước khi nghiệm thu SL-009 đầy đủ.

**Mục tiêu:** Android background và restart recovery: Candidate trong cùng process được cancelled hoặc confirmed một lần; candidate qua process restart được chuyển sang review nếu không thể xác minh thời gian; active timer được phục hồi.

**Slice:** SL-009. **Ưu tiên đề xuất:** P0. **Release:** MVP + activation/Premium; post-MVP deferred. SL-036 chỉ được tính release sau D6.

**Trạng thái kế hoạch:** APPROVED — Expo Go best-effort; native Android lifecycle/WorkManager deferred.
**Trạng thái implementation quan sát:** Expo Go AppState/SQLite best-effort đã được thêm; chưa có evidence chạy trên Android thật. Native lifecycle adapter chưa có.
**Baseline khảo sát:** docs/p6.0-implementation-slices tại 57ca1eb28a2952c66d01f89b9b89bf755ab4812a.
**Ngày soạn:** 2026-10-13, Asia/Saigon.
**Plan slug:** `2026-10-13-sl-009-android-recovery`; mọi commit thực hiện plan này phải bắt đầu `[2026-10-13-sl-009-android-recovery]`.
**Quyết định human:** Ưu tiên tiếp tục chạy Expo Go. Dùng React Native `AppState` + SQLite durable candidate và reconcile khi app resume/reopen; không thêm custom native module hoặc WorkManager trong phạm vi này. Nếu candidate thuộc process cũ, Expo Go không có monotonic reference để xác minh UTC; chuyển candidate sang `NEEDS_REVIEW` và không tự ghi điểm. Nếu Android dừng process trước khi callback JavaScript kịp commit candidate, không thể bảo đảm phục hồi. Native acceptance cần Development Build.
**Đầu vào phạm vi:** Backlog P6.0 v0.1 trong cuộc trò chuyện ngày 2026-10-13; execution chỉ được duyệt theo phần giới hạn nêu trên.
**Traceability:** US-04; ADR-008; ARCH §3.4; V03–V04.
**Phụ thuộc bắt buộc:** [SL-007](./2026-10-13-sl-007-foreground-detection.md)
**Ưu tiên mềm:** Theo thứ tự đề xuất trong [mục lục](../../implementation-plan.md); thứ tự không tạo thêm hard dependency.

## 1. Nguồn và ranh giới

Đọc [PRD](../../product-requirements.md), [Feature Spec](../../feature-specification.md), [Product Design](../../product-design.md), [Design Brief](../../product-design-brief.md), [Architecture](../../software-architecture.md), [API contracts](../../api-contracts.md), ADR áp dụng trong [decisions](../../decisions), cùng AGENTS ở app root. Tham chiếu cụ thể của slice nằm trong Traceability phía trên.

V01–V10 chỉ các màn tương ứng tại `design/concepts/concept-final/screens/`; prototype nằm tại `prototype/`. Chúng là read-only visual/interaction references, không chứng minh integration. Nếu journey không có design screen, trình bày gap với human trước quyết định UI mới.

**Kiến trúc:** Android lifecycle/recovery controller sở hữu hành vi của slice. Presentation đọc kết quả qua controller/repository; không tự trở thành nguồn authoritative. Units và đường dẫn mới bên dưới là đề xuất, chưa tồn tại trên baseline; nếu prerequisite đã tạo cùng trách nhiệm thì reuse, không thêm convention thứ hai.

**Stack:** Expo SDK 57 / React Native / TypeScript. Phạm vi được duyệt dùng `AppState` + SQLite để hoạt động trong Expo Go; không phụ thuộc Java, custom native module hay WorkManager. Không bắt slice thuần local phải có network.

**Không gồm:** Giữ process sống vô hạn; tự suy thời lượng candidate cross-process chỉ từ UTC.

## 2. Blocker, risk và quyết định cần duyệt

- **E1 (deferred):** Development Build và thiết bị Android cần cho native/integration evidence. Không chặn implementation best-effort Expo Go, nhưng slice không được tuyên bố nghiệm thu đầy đủ khi chưa có evidence này.

**Rủi ro cụ thể:** Clock-anomaly outcome và battery restrictions cần review trước execution.

Nếu một contract chỉ có responsibility mà chưa có schema, task đầu là trình bày missing decision với nguồn; không tự tạo endpoint/field mới. Các hành vi test bên dưới mô tả outcome cần đạt, không thay thế wire approval. Ngưỡng/range/default chưa được spec xác định phải có quyết định ghi lại trước khi implement.

## 3. File và quyền sở hữu dự kiến

Các đường dẫn sau tương đối với `dontlift-mobile/`. Đọc lại trạng thái file lúc execute để chọn Create/Modify; không ghi đè implementation của dependency.

| File dự kiến | Trách nhiệm |
|---|---|
| `src/features/solo/background-recovery.ts` | Lưu candidate và reconcile idempotent trong SQLite; dùng monotonic cùng UTC khi còn cùng JS process, route candidate từ process cũ sang review. |
| `src/features/solo/grace-period-engine.ts` | Khôi phục violation đang mở sau process restart để tiếp tục một lift, tránh ghi trùng. |
| `src/features/solo/violation-repository.ts` | Đọc violation đang mở của đúng session và user. |
| `src/features/local/migrations.ts` | Thêm schema lifecycle candidate theo versioned migration, giữ nguyên local data hiện tại. |
| `src/app/index.tsx` | Gọi lưu/reconcile candidate qua `AppState` và trước khi khôi phục session Solo. |
| `__tests__/android-recovery.test.ts` | Kiểm thử grace period, restart reconciliation, idempotency, clock anomaly và cutoff session. |

**Unit:** Android lifecycle/recovery controller.
**Nhận:** Foreground/background transitions, persisted candidate và clock markers.
**Trả:** Candidate cancelled hoặc confirmed một lần; active timer được phục hồi.
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

### Task 1 — Boundary và quy tắc của Android background và restart recovery

**Files:** Dùng units/config/backend/repositories trong bảng mục 3; khi test source đã được chỉ định, đặt cases thuộc boundary vào đúng app/backend target. Không thay presentation chưa cần cho task này.

**Nhận/trả:** Nhận Foreground/background transitions, persisted candidate và clock markers; trả Candidate cancelled hoặc confirmed một lần; active timer được phục hồi. Với contract đang bị chặn, chưa có quyền thêm schema dù test outcome đã được nêu.

- [x] Đọc lại source/spec và xác nhận dependency SL-007/008; native evidence được ghi rõ là deferred theo lựa chọn Expo Go.
- [ ] Viết focused failing cases sau đây; runner không tìm thấy hoặc thiếu dependency không được tính là red nghiệp vụ.

- [x] Background 2 giây → cancel (SQLite unit test).
- [x] Background đủ 3 giây → confirm một lần (SQLite unit test).
- [ ] Process restart trước/sau grace → `NEEDS_REVIEW`, không tự ghi violation/outbox khi UTC không thể xác minh (SQLite unit test; assertion cập nhật, chưa chạy lại).
- [x] Fresh install/upgrade → lifecycle candidate schema được migrate trước khi AppState persist candidate (SQLite migration test).
- [ ] Expo Go Android → AppState callback lưu và reconcile candidate qua SQLite.

- [ ] Chạy focused command trong mục 7; xác nhận failure đúng behavior đang thiếu, không từ toolchain lỗi.
- [ ] Xây hành vi theo thứ tự sau, chỉ sau approval:

1. Tạo lifecycle-candidate migration trước khi adapter ghi dữ liệu.
2. Ghi candidate durable từ AppState; repeated transition reuse cùng candidate.
3. Resume trong cùng process: dưới 3 giây hủy candidate; từ 3 giây xác nhận violation và matching outbox atomically một lần nếu UTC/monotonic không lệch quá ngưỡng.
4. Sau process restart không còn monotonic reference đáng tin trong Expo Go; chuyển candidate sang `NEEDS_REVIEW` thay vì tin UTC và tự cộng điểm.

- [x] Chạy lại focused cases và đối chiếu output/invariants; native/integration không được tính PASS từ mock.
- [ ] Review task và commit chỉ files thuộc task nếu execution được phép. Subject dùng `[2026-10-13-sl-009-android-recovery]`, trailer `Plan: docs/superpowers/plans/2026-10-13-sl-009-android-recovery.md` và `Task: 1`.

### Task 2 — Journey tích hợp và recovery

**Files:** Presentation/adapter/evidence trong mục 3 cùng boundary task 1; không refactor screen không liên quan. Task này không tạo implementation thứ hai cho unit task 1.

**Nhận:** Output task 1 đã kiểm chứng. **Trả:** Journey/bằng chứng có thể nghiệm thu; error/offline không false-success.

- [ ] Viết các failing cases về integration/recovery sau; không viết tests chỉ mirror implementation.

- [ ] Repeated ON_STOP → một candidate.
- [ ] AppState callback lặp → một candidate; cross-process recovery không tự tạo event khi elapsed time chưa xác minh (SQLite unit test; assertion cập nhật, chưa chạy lại).
- [x] Clock bị lùi → không âm thầm tự chốt score (SQLite unit test).

- [ ] Chạy focused checks, xác nhận failure đúng behavior; giữ fixtures tách khỏi device evidence.
- [x] Tích hợp theo thứ tự:

1. Resume timer theo persisted start/duration; không reset session.
2. Không có background worker trong Expo Go; chỉ reconcile khi app resume/reopen.
3. Khi reboot/clock anomaly không thể suy elapsed an toàn, dùng policy được duyệt và hiển thị recovery cần xử lý thay đoán.
4. Giữ violation foreground đang mở qua background/restart; không tạo thêm event cho cùng một lift.

- [ ] Thực hiện các kịch bản nghiệm thu trực tiếp trong mục 6; thu logs an toàn/device timestamps khi cần.
- [ ] Review kết quả; một branch fail hoặc thiếu required device/emulator evidence thì slice chưa hoàn thành.
- [ ] Commit task sau review nếu execution được phép. Subject dùng `[2026-10-13-sl-009-android-recovery]`, trailer `Plan: docs/superpowers/plans/2026-10-13-sl-009-android-recovery.md` và `Task: 2`.

## 6. Nghiệm thu và failure outcomes

- [x] Background 2 giây → cancel (unit test).
- [x] Background đủ 3 giây → confirm một lần (unit test).
- [ ] Restart trước/sau grace → candidate cần review, không ghi violation/outbox dựa vào UTC một mình (test assertion cập nhật, chưa chạy lại).
- [ ] Repeated ON_STOP → một candidate.
- [x] AppState callback lặp → một candidate; retry reconciliation không tạo duplicate (unit test).
- [x] Violation foreground đang mở → controller restore event sau restart và không tạo lift trùng (unit test).
- [x] Clock bị lùi → không tự ghi violation; giữ trạng thái cần review (unit test).
- [ ] Android thật với battery optimization/kill/relaunch → records tồn tại (UNVERIFIED trong Expo Go nếu process bị dừng trước callback JS).
- [ ] Android Development Build/native ON_STOP/WorkManager → deferred, không thuộc implementation Expo Go hiện tại.
- [ ] Clock bị lùi → không tự ghi violation; giữ trạng thái cần review.

Mỗi case phải có actual result. Unit cases dùng controlled fixtures để chứng minh domain; Firebase boundary cần Rules/Functions emulator tests cho allowed/denied/replay/concurrency khi áp dụng. Expo Go AppState cần kiểm tra trên Android thật; process-kill trước khi callback JS commit và native ON_STOP/WorkManager vẫn UNVERIFIED. Không có evidence thì ghi UNVERIFIED và blocker, không tick PASS.

**Failure recovery bắt buộc:** không hiển thị successful save/transition khi commit/request chưa thành công; giữ dữ liệu/retry context theo hành vi cụ thể trong tasks. Không log email đầy đủ, token, activation code hoặc bank details. Case không áp dụng cho slice phải ghi lý do trong evidence, không bỏ im lặng.

## 7. Verification và ghi nhận evidence

App focused tests sau khi SL-001 cấu hình runner: `pnpm test --runTestsByPath __tests__/android-recovery.test.ts`. TypeScript: `pnpm exec tsc --noEmit`. Lint: `pnpm run lint` chỉ khi repository có ESLint setup thực tế.

Lệnh app chạy từ `dontlift-mobile/`; file paths tests/backend ở trên là planned targets. Command chỉ được chạy sau harness/dependency prerequisites. Native build/emulator commands phải lấy từ cấu hình thật sau SL-002; không đoán project ID, runtime hoặc production alias. Future schema/index changes được test với approved edition Standard.

**Evidence 2026-10-19:** baseline `c815c7c` trên `feature/sl-009-android-recovery`; Node `v24.14.1`. `node node_modules/typescript/bin/tsc --noEmit` exit 0. Toàn bộ Jest suite chạy bằng `node node_modules/jest/bin/jest.js --watchAll=false --runInBand`: 12 suites, 100 tests passed. `git diff --check` exit 0. Lint chưa chạy: repo chưa có ESLint config; `expo lint` tự thêm dependency, thao tác đã dừng và ba file manifest/lock được hoàn nguyên. `adb devices -l` không thấy thiết bị; Expo Go AppState và Android process-kill vẫn UNVERIFIED. Chưa commit theo chỉ dẫn người dùng.

**Review follow-up 2026-10-19:** Cùng-process recovery đối chiếu UTC với monotonic và đưa sai lệch trên 1 giây vào `NEEDS_REVIEW`. Cross-process candidates luôn cần review vì Expo Go không có clock reference bền để phát hiện wall-clock jump; các assertion SQLite liên quan đã cập nhật nhưng chưa chạy lại.

## 8. Human review và bàn giao P6.2

Human đã duyệt phạm vi Expo Go best-effort ngày 2026-10-18. Phạm vi đó không nghiệm thu native ON_STOP/WorkManager; nếu muốn làm phần native sau này cần review scope và evidence riêng.

Implementation Expo Go được kiểm thử bằng unit/SQLite, nhưng Android thật và process-kill còn UNVERIFIED. Không tự bắt đầu P6.2 từ file draft hoặc từ prompt batch.

**Review follow-up — recovery/finalization ordering 2026-10-19:** Recovery dùng state để countdown zero chạy lại sau reconciliation, kèm ref chặn đồng bộ mọi đường Finish/Retry/Cancel (bao gồm callback của hộp xác nhận đã mở). Khóa được mở sau khi reconcile và detector initialize thành công; sensor drain tạm dừng trong lúc phục hồi. Resume đợi thao tác lưu candidate đang chạy trước khi reconcile. TypeScript (node node_modules/typescript/bin/tsc --noEmit) exit 0. Chưa chạy lại test suite. Android thật còn UNVERIFIED: countdown hết giờ trong background phải mở summary khi resume; Finish/Cancel trong recovery phải bị khóa và chỉ hoạt động sau khi phục hồi xong.
**Chuyển ownership repository 2026-10-19 (SL-010):** Repository được đổi tên thành src/features/solo/background-recovery.ts và dùng chung cho Android/iOS. AppState orchestration nằm trong session-lifecycle-controller.ts. Schema lifecycle_candidates v5 được giữ nguyên; mọi caller đã chuyển sang factory createBackgroundRecoveryRepository. Các SQLite tests SL-009 vẫn được chạy như regression coverage.