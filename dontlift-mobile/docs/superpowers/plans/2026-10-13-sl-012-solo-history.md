# Kế hoạch triển khai P6.1 — SL-012: Xem Solo history

> **For agentic workers:** REQUIRED SUB-SKILL: Use the qskill-executing-plans skill to implement this plan task-by-task. Steps use checkbox tracking.
> Kế hoạch chỉ mô tả file, unit, hành vi, quy tắc, đầu ra và test cases; không có implementation code hoặc signatures. Đọc source thật trước mỗi task.
> **Gate:** Không execute kế hoạch khi trạng thái còn DRAFT hoặc khi blocker/dependency chưa giải quyết. Việc tạo file này không phê duyệt backlog hay P6.2.

**Mục tiêu:** Xem Solo history: List/detail local-first, stable merge và pagination không duplicate.

**Slice:** SL-012. **Ưu tiên đề xuất:** P1. **Release:** MVP + activation/Premium; post-MVP deferred. SL-036 chỉ được tính release sau D6.

**Trạng thái kế hoạch:** APPROVED — human yêu cầu triển khai SL-012 trong cuộc trò chuyện ngày 2026-10-19.
**Trạng thái implementation quan sát:** Đã triển khai list/detail local-first, cloud pagination/cache, retention filtering và navigation. Automated checks đã pass; nghiệm thu Expo Go trên thiết bị và dữ liệu Cloud thật còn UNVERIFIED.
**Baseline khảo sát:** Nhánh feature/sl-012-solo-history tại dc5ef9e sau khi merge PR #37 (SL-011).
**Ngày soạn:** 2026-10-13, Asia/Saigon.
**Plan slug:** `2026-10-13-sl-012-solo-history`; mọi commit thực hiện plan này phải bắt đầu `[2026-10-13-sl-012-solo-history]`.
**Đầu vào phạm vi:** User đã yêu cầu triển khai riêng SL-012 trong cuộc trò chuyện ngày 2026-10-19 sau khi được giải thích list/detail Solo history và nhánh feature/sl-012-solo-history. Approval này không bao gồm các slice sau.
**Traceability:** US-16; ARCH §6.1/7.2; ADR-002.
**Phụ thuộc bắt buộc:** [SL-011](./2026-10-13-sl-011-solo-sync.md)

**Quyết định execution hiện tại:** Reuse Expo Go + Firebase JS SDK theo ADR-010; owner Rules đã được SL-011 thêm vào canonical `firestore.rules`, không tạo policy emulator thứ hai. Dùng FlatList ngoài ScrollView, entry trong tab Solo và các metric/card hiện có vì chưa có mockup History riêng. Không thêm dependency/backend endpoint/deploy. Cloud cache có bảng riêng và không tạo domain session/outbox. Local Premium chưa có provider (SL-031), hiện mặc định Free; Server Premium được đọc từ profile server khi query cloud. Không tự commit/push trong lượt này khi human chưa yêu cầu riêng cho SL-012.
**Ưu tiên mềm:** Theo thứ tự đề xuất trong [mục lục](../../implementation-plan.md); thứ tự không tạo thêm hard dependency.

## 1. Nguồn và ranh giới

Đọc [PRD](../../product-requirements.md), [Feature Spec](../../feature-specification.md), [Product Design](../../product-design.md), [Design Brief](../../product-design-brief.md), [Architecture](../../software-architecture.md), [API contracts](../../api-contracts.md), ADR áp dụng trong [decisions](../../decisions), cùng AGENTS ở app root. Tham chiếu cụ thể của slice nằm trong Traceability phía trên.

V01–V10 chỉ các màn tương ứng tại `design/concepts/concept-final/screens/`; prototype nằm tại `prototype/`. Chúng là read-only visual/interaction references, không chứng minh integration. Nếu journey không có design screen, trình bày gap với human trước quyết định UI mới.

**Kiến trúc:** Solo history repository sở hữu hành vi của slice. Presentation đọc kết quả qua controller/repository; không tự trở thành nguồn authoritative. Units và đường dẫn mới bên dưới là đề xuất, chưa tồn tại trên baseline; nếu prerequisite đã tạo cùng trách nhiệm thì reuse, không thêm convention thứ hai.

**Stack:** Expo SDK 57 / React Native / TypeScript, Expo Go + Firebase JS SDK theo ADR-010. SQLite giữ domain records và cache bền vững; Firestore Standard owner reads bổ sung history. SL-012 không thêm callable hoặc cloud writes.

**Không gồm:** Group history, analytics và physical purge thuộc 028/033.

## 2. Blocker, risk và quyết định cần duyệt

- Không có blocker riêng được xác nhận trong draft; dependency và quyền/runtime vẫn phải đạt gate trước thực thi.

**Rủi ro cụ thể:** Retention cutoff, large-list virtualization và stale snapshot.

Nếu một contract chỉ có responsibility mà chưa có schema, task đầu là trình bày missing decision với nguồn; không tự tạo endpoint/field mới. Các hành vi test bên dưới mô tả outcome cần đạt, không thay thế wire approval. Ngưỡng/range/default chưa được spec xác định phải có quyết định ghi lại trước khi implement.

## 3. File và quyền sở hữu dự kiến

Các đường dẫn sau tương đối với `dontlift-mobile/`. Đọc lại trạng thái file lúc execute để chọn Create/Modify; không ghi đè implementation của dependency.

| File dự kiến | Trách nhiệm |
|---|---|
| `firestore.rules` | Reuse owner-scoped Solo history reads đã có từ SL-011; rules harness trỏ đúng canonical file, giữ deny client authoritative writes. |
| `functions/tests/solo-history-rules.emulator.test.cjs` | Rules integration cases theo resource, dùng harness/dependencies backend SL-003 và Emulator Suite; no runtime install trong P6.1. |
| `src/features/history/solo-history-repository.ts` | Unit/repository/adapter chuyên trách; reuse nếu prerequisite đã tạo. |
| `src/features/history/history-controller.ts` | Unit/repository/adapter chuyên trách; reuse nếu prerequisite đã tạo. |
| `src/screens/HistoryScreen.tsx` | Presentation và states của journey; không chứa domain math/sync authority. |
| `src/app/index.tsx` | Đăng ký state/render route cho History theo mô hình điều hướng hiện có. |
| `src/types.ts` | Thêm ScreenId cho History. |
| `src/constants.ts` | Thêm title cho History vào map hiện có. |
| `src/screens/SoloSelectScreen.tsx` | Thêm entry nhìn thấy được để mở History từ tab Solo. |
| `__tests__/solo-history.test.ts` | Kiểm thử dự kiến; chưa tạo test source trong P6.1. |
| `__tests__/solo-history-navigation.test.ts` | Kiểm thử route, entry từ SoloSelect và render History. |
| `src/features/history/history-model.ts` | Typed history, canonical data validation và stable merge. |
| `src/features/local/migrations.ts` | Migration 6 bổ sung cloud summary cache và indexes, giữ nguyên sessions/outbox. |
| `src/components/BottomNav.tsx` | History thuộc Solo tab hiện tại. |
| `__tests__/solo-history-storage.test.ts` | SQLite thật: ownership, retention cutoff, cache, cursor pagination. |

**Unit:** Solo history repository.
**Nhận:** Current UID, local sessions, owner-scoped cloud pages và retention context.
**Trả:** List/detail local-first, stable merge và pagination không duplicate.
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

### Task 0 — Solo history Rules coverage trước cloud read

SL-012 reuse owner path users/{uid}/sessions đã được SL-011 thêm vào firestore.rules, và bổ sung functions/tests/solo-history-rules.emulator.test.cjs. Reuse local config cùng Rules harness hiện có; chưa có thì dừng cloud integration.

- [ ] Owner đọc list/detail/page của chính mình được; anonymous hoặc user khác bị deny.
- [ ] Client direct-write Solo summaries bị deny, gồm create/update/delete; syncEvents vẫn là write authority.
- [ ] Retention/query constraints khớp approved server entitlement và query shape, không dùng Rules làm bộ lọc.
- [ ] Seed bằng Admin chỉ tạo fixtures; assertions dùng client SDK trên emulator, không live project.
- [ ] Regression default-deny và resource Rules cũ phải pass; SL-037 tiếp nhận canonical deployment file sau authorization, không tự tạo ở slice này.

### Task 1 — Boundary và quy tắc của Xem Solo history

**Files:** Dùng units/config/backend/repositories trong bảng mục 3; khi test source đã được chỉ định, đặt cases thuộc boundary vào đúng app/backend target. Không thay presentation chưa cần cho task này.

**Nhận/trả:** Nhận Current UID, local sessions, owner-scoped cloud pages và retention context; trả List/detail local-first, stable merge và pagination không duplicate. Với contract đang bị chặn, chưa có quyền thêm schema dù test outcome đã được nêu.

- [ ] Đọc lại source/spec và xác nhận tất cả blocker cùng dependency cho task đã được giải quyết; nếu chưa, dừng execution và báo đúng blocker.
- [ ] Viết focused failing cases sau đây; runner không tìm thấy hoặc thiếu dependency không được tính là red nghiệp vụ.

- [ ] Offline có local history → list/detail đọc được.
- [ ] Offline không history → empty và trạng thái offline, không crash.
- [ ] Hai pages overlap → một record/session.

- [ ] Chạy focused command trong mục 7; xác nhận failure đúng behavior đang thiếu, không từ toolchain lỗi.
- [ ] Xây hành vi theo thứ tự sau, chỉ sau approval:

1. Đọc local completed sessions trước; không chờ network để hiện cached history.
2. Cloud query owner path, completedAt descending và cursor; chỉ merge canonical records của user.
3. Áp retention filter Free/Server Premium theo authority; giữ local pending dữ liệu theo ADR-002.

- [ ] Chạy lại các cases và đối chiếu output/invariants; không tuyên bố native/integration PASS từ mock.
- [ ] Review task và commit chỉ files thuộc task nếu execution được phép. Subject dùng `[2026-10-13-sl-012-solo-history]`, trailer `Plan: docs/superpowers/plans/2026-10-13-sl-012-solo-history.md` và `Task: 1`.

### Task 2 — Journey tích hợp và recovery

**Files:** Presentation/adapter/evidence trong mục 3 cùng boundary task 1; không refactor screen không liên quan. Task này không tạo implementation thứ hai cho unit task 1.

**Nhận:** Output task 1 đã kiểm chứng. **Trả:** Journey/bằng chứng có thể nghiệm thu; error/offline không false-success.

- [ ] Viết các failing cases về integration/recovery sau; không viết tests chỉ mirror implementation.

- [ ] User B truy cập user A → bị deny.
- [ ] Cloud request fail → cached list giữ nguyên và retry.
- [ ] Free-retention boundary → dữ liệu hiển thị đúng cutoff.
- [ ] Từ SoloSelect mở History → History route được chọn và HistoryScreen hiển thị; quay lại SoloSelect không làm mất lựa chọn tab hiện tại.
- [ ] Chạy `__tests__/solo-history-navigation.test.ts` và xác nhận entry/route/title/render của History được nối đầy đủ.

- [ ] Chạy focused checks, xác nhận failure đúng behavior; giữ fixtures tách khỏi device evidence.
- [ ] Tích hợp theo thứ tự:

1. Có loading/empty/error/cached/syncing state và retry; không dùng mock stats.
2. Detail đủ date/duration/lift count/violation duration/score; list không tạo duplicate khi page overlap.
3. Changing user hủy listeners và pagination cũ; không leak history.
4. Đăng ký History trong ScreenId/title/render state hiện có và đặt entry từ SoloSelect; không thêm tab thứ sáu vào BottomNav.

- [ ] Thực hiện các kịch bản nghiệm thu trực tiếp trong mục 6; thu logs an toàn/device timestamps khi cần.
- [ ] Review kết quả; một branch fail hoặc thiếu required device/emulator evidence thì slice chưa hoàn thành.
- [ ] Commit task sau review nếu execution được phép. Subject dùng `[2026-10-13-sl-012-solo-history]`, trailer `Plan: docs/superpowers/plans/2026-10-13-sl-012-solo-history.md` và `Task: 2`.

## 6. Nghiệm thu và failure outcomes

- [ ] Offline có local history → list/detail đọc được.
- [ ] Offline không history → empty và trạng thái offline, không crash.
- [ ] Hai pages overlap → một record/session.
- [ ] User B truy cập user A → bị deny.
- [ ] Cloud request fail → cached list giữ nguyên và retry.
- [ ] Free-retention boundary → dữ liệu hiển thị đúng cutoff.
- [ ] User mở History từ SoloSelect → đúng route/title/screen; điều hướng quay lại không làm sai Solo selection.
- [ ] Complete vài session, offline mở list/detail → dữ liệu thật.
- [ ] Cloud fills gaps → list merge đúng, order không nhảy ngẫu nhiên.

Mỗi case phải có actual result. Unit cases dùng controlled fixtures để chứng minh domain; Firebase boundary cần Rules/Functions emulator tests cho allowed/denied/replay/concurrency khi áp dụng. Sensor/lifecycle cần physical devices. Không có evidence thì ghi UNVERIFIED và blocker, không tick PASS.

**Failure recovery bắt buộc:** không hiển thị successful save/transition khi commit/request chưa thành công; giữ dữ liệu/retry context theo hành vi cụ thể trong tasks. Không log email đầy đủ, token, activation code hoặc bank details. Case không áp dụng cho slice phải ghi lý do trong evidence, không bỏ im lặng.

## 7. Verification và ghi nhận evidence

Rules integration trước cloud history: `node --test functions/tests/solo-history-rules.emulator.test.cjs` bên trong Emulator Suite đã được SL-002/003 chuẩn bị; thiếu environment là blocker/failure, không skipped PASS.

App focused tests sau khi SL-001 cấu hình runner: `pnpm test --runTestsByPath __tests__/solo-history.test.ts`. Backend focused tests sau backend bootstrap SL-003 và native/emulator prerequisites SL-002: `node --test functions/tests/solo-history.test.cjs`. TypeScript: `pnpm exec tsc --noEmit`. Lint: `pnpm run lint` chỉ khi repository có ESLint setup thực tế.

Navigation focused test: `pnpm test --runTestsByPath __tests__/solo-history-navigation.test.ts`.

Lệnh app chạy từ `dontlift-mobile/`; file paths tests/backend ở trên là planned targets. Command chỉ được chạy sau harness/dependency prerequisites. Native build/emulator commands phải lấy từ cấu hình thật sau SL-002; không đoán project ID, runtime hoặc production alias. Future schema/index changes được test với approved edition Standard.

Ghi trong kết quả execution: baseline/commit mới, command, exit status, số cases, emulator/device/runtime version, date, actual outcomes và remaining gaps. Các checklist hiện đều chưa chạy.

## 8. Human review và bàn giao P6.2

Human phải duyệt scope, non-goals, tasks, acceptance cases, dependencies và các quyết định còn mở của **SL-012** trước implementation. Duyệt một slice không duyệt tất cả 37; duyệt authoring batch không duyệt code.

Sau approval, cập nhật trạng thái/date/decision evidence trong đúng plan; kế hoạch mới chỉ đủ execution-ready khi blocker đã được giải quyết và baseline được re-inspect. Dùng qskill-executing-plans khi user yêu cầu execute plan đã duyệt. Không tự bắt đầu P6.2 từ file draft hoặc từ prompt batch.

## 9. Execution evidence — 2026-10-19

Thực hiện trực tiếp tại `D:\DontLift-Mobile`, nhánh `feature/sl-012-solo-history`, baseline `dc5ef9e`. Node 24.14.1. Chưa commit/push theo yêu cầu human về commit riêng.

| Check | Actual result |
|---|---|
| `pnpm exec tsc --noEmit` | PASS, exit 0. |
| `pnpm test --runInBand` | PASS, 17 suites / 140 tests, exit 0. |
| History controller/model | PASS: local-first, offline empty, owner filtering, canonical merge, overlap, cursor retry, refresh ACK/cutoff và bỏ kết quả khi disposed. |
| SQLite thật qua Node SQLite | PASS: migration 6, user isolation, cutoff 7 ngày inclusive, giữ unsynced, cache idempotent, 45 rows có cùng timestamp phân trang không trùng/thiếu, không sinh sessions/outbox từ cloud cache. Migration regression giữ profile/session cũ. |
| Firestore emulator (Standard), demo-dontlift-expo-go, Java 21 | PASS, 10 Rules tests gồm profile regressions và Solo owner list/detail/cursor; anonymous/cross-user/direct writes bị deny. Chạy `firebase emulators:exec --config ../firebase.emulator.json --project demo-dontlift-expo-go --only firestore "node --test tests/solo-history-rules.emulator.test.cjs tests/profile-owner-read.rules.emulator.test.cjs"` từ functions/. |
| `pnpm exec expo export --platform android --output-dir .expo/sl012-check` | PASS, Android bundle 1,831 modules, exit 0. Đây là bundle check, không phải device test. |
| Browser component preview | PASS với repository fixtures ghi rõ là kiểm thử: khung 360px, list/detail/empty, Retry giữ list khi cloud fail, quay lại list, labels/roles và nội dung không tràn ngang. Preview entry/HTML đã xóa; không ship fixture data. |
| Full web app | UNVERIFIED: hiện bị `expo-sqlite/web/worker.ts` worker chunk error. Component preview độc lập bỏ qua root bootstrap để kiểm tra presentation; không sửa lỗi web ngoài slice. |
| Lint | NOT RUN: không có ESLint package/config trong checkout; không cài thêm dependency. |
| Expo Go Android/iOS, offline restart và Cloud thật | UNVERIFIED: chưa có actual device/session walkthrough. Cần complete session → Solo / View Solo history → detail → offline/reopen → reconnect. Cloud fills gaps cần summaries đã được SL-011 sync lên tài khoản; không coi Functions đã deploy từ việc merge code. |

Design read: lịch sử cá nhân theo thời gian, reuse Liquid Acrylic hiện có; ENERGY 1 / RHYTHM 1 / MOTION 1. Dùng hàng danh sách để ưu tiên ngày/thời gian, một card detail cho các metric; FlatList tránh lồng danh sách động vào ScrollView. Reuse tokens giúp cùng độ tương phản với các màn Solo hiện tại. Các nút có handler thật và role; không thêm thống kê giả, tab mới hoặc animations không có mục đích.

Local Premium provider thuộc SL-031 chưa triển khai nên composition hiện tại dùng Free; repository nhận retention context riêng. Server retention query dựa profile đọc từ server, không lấy Local Premium cấp quyền cloud. Physical purge vẫn thuộc SL-033. SL-012 không có backend command mới nên không tạo `functions/tests/solo-history.test.cjs`; boundary coverage nằm trong Rules test hiện có. UI/controller dùng Firebase JS SDK, không thêm dependency hoặc thay lockfiles.

### Cloud history read fix — 2026-10-19

Sau khi human báo app hiển thị local history nhưng báo Cloud unavailable, đọc Rules đang deploy xác nhận bản cloud còn thiếu `users/{uid}/sessions` owner read. Đối chiếu local/cloud bằng script read-only xác nhận khác biệt duy nhất là block đọc Solo summary cho chính owner; các quyền profile và default-deny không đổi. Database `(default)` của `august-monument-508716-u0` được xác nhận là STANDARD và freeTier=true.

Deploy riêng `firestore:rules` với project/config cụ thể đã thành công; không deploy Functions hoặc indexes. Đọc lại Rules từ Firebase Rules API xác nhận `DEPLOYED_RULES_MATCH_TESTED_SOURCE: true`. Bản source này đã qua 10 Rules tests trên emulator ở trên. App cần Retry history để kiểm chứng request người dùng; actual device walkthrough vẫn chưa được ghi nhận. Không có code/dependency thay đổi trong fix này.
