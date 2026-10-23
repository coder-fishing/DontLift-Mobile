# Kế hoạch triển khai P6.1 — SL-030: Settings cho haptic và sound

> **For agentic workers:** REQUIRED SUB-SKILL: Use the qskill-executing-plans skill to implement this plan task-by-task. Steps use checkbox tracking.
> Kế hoạch chỉ mô tả file, unit, hành vi, quy tắc, đầu ra và test cases; không có implementation code hoặc signatures. Đọc source thật trước mỗi task.
> **Gate:** User đã duyệt riêng SL-030 ngày 2026-10-23; D11 đã giải quyết bên dưới. Approval này không duyệt backlog hoặc P6.2.

**Mục tiêu:** Settings cho haptic và sound: Persisted settings, capability-aware feedback không đổi scoring.

**Slice:** SL-030. **Ưu tiên đề xuất:** P1. **Release:** MVP + activation/Premium; post-MVP deferred. SL-036 chỉ được tính release sau D6.

**Trạng thái kế hoạch:** APPROVED riêng cho SL-030 ngày 2026-10-23; D11 RESOLVED; implementation đang tiến hành.
**Trạng thái implementation:** Phần code đã triển khai; chờ user xác nhận UI và feedback native trên thiết bị thật.
**Baseline khảo sát:** docs/p6.0-implementation-slices tại 57ca1eb28a2952c66d01f89b9b89bf755ab4812a.
**Ngày soạn:** 2026-10-13, Asia/Saigon.
**Plan slug:** `2026-10-13-sl-030-feedback-settings`; mọi commit thực hiện plan này phải bắt đầu `[2026-10-13-sl-030-feedback-settings]`.
**Đầu vào phạm vi:** Backlog P6.0 v0.1 trong cuộc trò chuyện ngày 2026-10-13, chưa được phê duyệt. User đã yêu cầu ghi draft P6.1 cho cả 37 slice; không suy thành approval thực thi.
**Traceability:** US-18; ARCH §6.3; FS §4.1.
**Phụ thuộc bắt buộc:** [SL-003](./2026-10-13-sl-003-registration-profile.md), [SL-004](./2026-10-13-sl-004-login-session.md), [SL-007](./2026-10-13-sl-007-foreground-detection.md)
**Ưu tiên mềm:** Theo thứ tự đề xuất trong [mục lục](../../implementation-plan.md); thứ tự không tạo thêm hard dependency.

## 1. Nguồn và ranh giới

Đọc [PRD](../../product-requirements.md), [Feature Spec](../../feature-specification.md), [Product Design](../../product-design.md), [Design Brief](../../product-design-brief.md), [Architecture](../../software-architecture.md), [API contracts](../../api-contracts.md), ADR áp dụng trong [decisions](../../decisions), cùng AGENTS ở app root. Tham chiếu cụ thể của slice nằm trong Traceability phía trên.

V01–V10 chỉ các màn tương ứng tại `design/concepts/concept-final/screens/`; prototype nằm tại `prototype/`. Chúng là read-only visual/interaction references, không chứng minh integration. Nếu journey không có design screen, trình bày gap với human trước quyết định UI mới.

**Kiến trúc:** feedback settings repository/service sở hữu hành vi của slice. Presentation đọc kết quả qua controller/repository; không tự trở thành nguồn authoritative. Units và đường dẫn mới bên dưới là đề xuất, chưa tồn tại trên baseline; nếu prerequisite đã tạo cùng trách nhiệm thì reuse, không thêm convention thứ hai.

**Stack:** Expo SDK 57 / React Native / TypeScript. SQLite cho local-first khi slice có persistence; React Native Firebase Auth/Firestore Standard/Functions cho boundary có Firebase. Không bắt slice thuần local phải có network.

**Không gồm:** Penalty weights, custom themes, ads-provider integration.

## 2. Blocker, risk và quyết định cần duyệt

- **D11 — RESOLVED 2026-10-23 theo quyết định của user:** Sound tắt mặc định; khi bật, phát một beep ngắn trung tính; preferences lưu cục bộ riêng theo tài khoản trên cùng thiết bị. Haptic bật mặc định theo PRD/Feature Spec hiện hành, có thể tắt trong Settings. Beep là WAV đóng gói trong app; không tải từ mạng.

**Rủi ro cụ thể còn lại:** Khả năng phát haptic/audio phụ thuộc thiết bị và thiết lập hệ điều hành; lỗi adapter phải không ảnh hưởng commit vi phạm hoặc điểm số.

Nếu một contract chỉ có responsibility mà chưa có schema, task đầu là trình bày missing decision với nguồn; không tự tạo endpoint/field mới. Các hành vi test bên dưới mô tả outcome cần đạt, không thay thế wire approval. Ngưỡng/range/default chưa được spec xác định phải có quyết định ghi lại trước khi implement.

## 3. File và quyền sở hữu dự kiến

Các đường dẫn sau tương đối với `dontlift-mobile/`. Đọc lại trạng thái file lúc execute để chọn Create/Modify; không ghi đè implementation của dependency.

| File dự kiến | Trách nhiệm |
|---|---|
| `src/features/settings/settings-repository.ts` | Lưu/đọc lựa chọn theo UID trong app_settings; repository lấy SQLite từ migration runner. |
| `src/features/settings/feedback-service.ts` | Đọc preference đã lưu và gọi riêng từng adapter, bỏ qua lỗi capability. |
| `src/screens/SettingsScreen.tsx` | SL-030 tạo màn hình Settings nền cho feedback preferences; các slice sau mở rộng màn hiện có, không tạo màn Settings thứ hai. |
| `src/app/index.tsx` | Đăng ký Settings screen state, render màn hình, và chỉ cho app shell đã xác thực điều hướng vào Settings. |
| `src/types.ts` | Bổ sung định danh Settings vào ScreenId dùng chung. |
| `src/constants.ts` | Bổ sung tiêu đề Settings theo ScreenId. |
| `src/components/Header.tsx` | Nối nút cài đặt của app shell đã xác thực tới SettingsScreen; không dùng prototype control deck làm đường sản phẩm. |
| `src/features/local/migrations.ts` | SL-030 mở rộng migration runner SL-003 bằng versioned `app_settings` schema theo Feature Specification; không tạo database bootstrap thứ hai. |
| `package.json` | Dùng expo-audio tương thích SDK 57; haptic dùng React Native Vibration có sẵn để theo pattern trong spec, không thêm package riêng. |
| `package-lock.json`, `pnpm-lock.yaml` | Cập nhật đồng bộ expo-audio. |
| `app.json` | Không cần plugin hay quyền ghi âm cho playback cue ngắn; không bật background audio. |
| `assets/audio/violation-alert.wav` | Beep mono ngắn 660 Hz, 160 ms, đóng gói trong app; sound off mặc định theo D11. |
| `src/features/solo/grace-period-engine.ts` | Unit/repository/adapter chuyên trách; reuse nếu prerequisite đã tạo. |
| `__tests__/feedback-settings.test.ts` | Kiểm thử dự kiến; chưa tạo test source trong P6.1. |

**Unit:** feedback settings repository/service.
**Nhận:** User preference haptic/sound và confirmed violation.
**Trả:** Persisted settings, capability-aware feedback không đổi scoring.
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

### Task 1 — Boundary và quy tắc của Settings cho haptic và sound

**Files:** Dùng units/config/backend/repositories trong bảng mục 3; khi test source đã được chỉ định, đặt cases thuộc boundary vào đúng app/backend target. Không thay presentation chưa cần cho task này.

**Nhận/trả:** Nhận User preference haptic/sound và confirmed violation; trả Persisted settings, capability-aware feedback không đổi scoring. D11 đã giải quyết; được phép thêm migration `app_settings` và WAV theo quyết định đã duyệt.

- [x] Đọc lại source/spec và xác nhận dependencies SL-003/004/007 tồn tại; D11 được user giải quyết ngày 2026-10-23.
- [ ] Viết focused failing cases sau đây; runner không tìm thấy hoặc thiếu dependency không được tính là red nghiệp vụ.

- [x] Haptic off → service không gọi adapter rung (unit test).
- [x] Haptic on theo mặc định → service gọi adapter một lần (unit test; native output còn chờ máy thật).
- [x] Sound off mặc định → service không gọi adapter âm thanh (unit test).
- [x] Fresh install → migration tạo app_settings trước lần đọc/ghi preference (SQLite test).
- [x] Upgrade từ schema cũ → app_settings được thêm và dữ liệu profile/session giữ nguyên (SQLite migration suite).
- [ ] Authenticated app shell → nút cài đặt mở SettingsScreen; unauthenticated user không vào được Settings route.
- [ ] Sound on, confirmed violation, supported device → bundled cue phát theo D11; unsupported audio không ngăn violation được lưu.

- [x] Chạy focused tests trong mục 7; các suite kết thúc thành công. Không lưu lại lượt RED trước implementation.
- [ ] Xây hành vi theo thứ tự sau, chỉ sau approval:

1. Đọc settings local trước feedback; persist changes theo current-user/settings scope được duyệt.
2. Khi database mở, chạy `app_settings` migration sau schema SL-003; settings repository không báo saved trước khi commit.
3. Settings entry chỉ hiện trong authenticated app shell và mở SettingsScreen qua navigation state/entrypoint được sở hữu tại đây.
4. Confirmed event mới phát haptic khi enabled/capability; sound theo toggle và asset đã duyệt.
5. Unsupported feedback không làm engine crash hoặc đổi score/grace.

- [x] Chạy lại focused cases và kiểm tra invariant lưu violation trước feedback; native integration không được suy ra từ mock.
- [ ] Review task và commit chỉ files thuộc task nếu execution được phép. Subject dùng `[2026-10-13-sl-030-feedback-settings]`, trailer `Plan: docs/superpowers/plans/2026-10-13-sl-030-feedback-settings.md` và `Task: 1`.

### Task 2 — Journey tích hợp và recovery

**Files:** Presentation/adapter/evidence trong mục 3 cùng boundary task 1; không refactor screen không liên quan. Task này không tạo implementation thứ hai cho unit task 1.

**Nhận:** Output task 1 đã kiểm chứng. **Trả:** Journey/bằng chứng có thể nghiệm thu; error/offline không false-success.

- [ ] Viết các failing cases về integration/recovery sau; không viết tests chỉ mirror implementation.

- [x] Restart → SQLite reopen trả đúng preference theo UID (SQLite test).
- [x] Feedback callback bị reject → engine vẫn trả violation đã lưu (controller test).
- [x] SQLite save fail → switch trở về giá trị cũ và báo lỗi (screen test).

- [x] Chạy focused checks; unit fixtures tách biệt với device evidence.
- [ ] Tích hợp theo thứ tự:

1. Expose enabled/disabled states bằng native semantics; restart giữ lựa chọn.
2. Sound package/native setup và bundled cue chỉ được thêm sau D11; manifest và lockfiles được cập nhật đồng bộ.
3. SQLite write fail → error/retry, UI không công bố persisted nếu chưa commit.
4. Settings không cần network; không render quảng cáo trong active-session route.

- [ ] Thực hiện các kịch bản nghiệm thu trực tiếp trong mục 6; thu logs an toàn/device timestamps khi cần.
- [ ] Review kết quả; một branch fail hoặc thiếu required device/emulator evidence thì slice chưa hoàn thành.
- [ ] Commit task sau review nếu execution được phép. Subject dùng `[2026-10-13-sl-030-feedback-settings]`, trailer `Plan: docs/superpowers/plans/2026-10-13-sl-030-feedback-settings.md` và `Task: 2`.

## 6. Nghiệm thu và failure outcomes

- [x] Haptic off/on, sound off, restart, adapter rejection, write fail → unit/component/SQLite cases pass.
- [x] Fresh install và upgrade → migration app_settings chạy, dữ liệu hiện tại được giữ.
- [ ] Authenticated user mở Settings từ app shell; unauthenticated user không truy cập được screen.
- [ ] Physical device toggles rồi lift thật → feedback theo lựa chọn.
- [ ] Sound enabled trên Android/iOS → cue được phát khi confirmed violation; sound disabled/unsupported → không phát, violation vẫn được ghi.
- [ ] Offline toggle/restart → settings còn.

Mỗi case phải có actual result. Unit cases dùng controlled fixtures để chứng minh domain; Firebase boundary cần Rules/Functions emulator tests cho allowed/denied/replay/concurrency khi áp dụng. Sensor/lifecycle cần physical devices. Không có evidence thì ghi UNVERIFIED và blocker, không tick PASS.

**Failure recovery bắt buộc:** không hiển thị successful save/transition khi commit/request chưa thành công; giữ dữ liệu/retry context theo hành vi cụ thể trong tasks. Không log email đầy đủ, token, activation code hoặc bank details. Case không áp dụng cho slice phải ghi lý do trong evidence, không bỏ im lặng.

## 7. Verification và ghi nhận evidence

App focused tests sau khi SL-001 cấu hình runner: `pnpm test --runTestsByPath __tests__/feedback-settings.test.ts`. Migration cases chạy cùng test file trên fresh schema và upgrade fixture. TypeScript: `pnpm exec tsc --noEmit`. Lint: `pnpm run lint` chỉ khi repository có ESLint setup thực tế.

Lệnh app chạy từ `dontlift-mobile/`; file paths tests/backend ở trên là planned targets. Command chỉ được chạy sau harness/dependency prerequisites. Native build/emulator commands phải lấy từ cấu hình thật sau SL-002; không đoán project ID, runtime hoặc production alias. Future schema/index changes được test với approved edition Standard.

**Execution evidence ngày 2026-10-23:** baseline `57b1174` trên nhánh `feature/sl-030-feedback-settings`; không commit.

- `pnpm test -- --runInBand __tests__/feedback-settings.test.ts __tests__/settings-screen.test.tsx __tests__/foreground-detection.test.ts __tests__/local-database.test.ts __tests__/group-history.test.ts` — PASS, 5 suites / 55 tests.
- `pnpm exec tsc --noEmit` — PASS.
- `pnpm exec expo install --check` — PASS theo SDK map cục bộ; môi trường offline nên Expo bỏ qua kiểm tra remote metadata.
- `pnpm exec expo export --platform android` — PASS; Android bundle được tạo và chứa `assets/audio/violation-alert.wav` (bundle 6.6 MB). Lượt đầu sandbox chặn Hermes ghi file tạm; lượt xác minh sau được chạy thành công.
- `pnpm run lint` — FAIL: repo chưa có cấu hình ESLint nên Expo tự tạo cấu hình mặc định rồi báo 41 lỗi / 26 cảnh báo trên nhiều file. Cấu hình tự sinh đã được bỏ; đây chưa phải lint baseline được repo thiết lập.
- Thiết bị Android/iOS chưa được dùng để kiểm tra haptic, âm thanh khi máy silent, thao tác UI, đổi tài khoản và restart thực tế. Các mục physical-device bên dưới vẫn UNVERIFIED.

Ghi remaining evidence từ máy thật trước khi đánh dấu slice nghiệm thu xong. Không commit, push hoặc deploy trong lượt này.

## 8. Human review và bàn giao P6.2

Human phải duyệt scope, non-goals, tasks, acceptance cases, dependencies và các quyết định còn mở của **SL-030** trước implementation. Duyệt một slice không duyệt tất cả 37; duyệt authoring batch không duyệt code.

Sau approval, cập nhật trạng thái/date/decision evidence trong đúng plan; kế hoạch mới chỉ đủ execution-ready khi blocker đã được giải quyết và baseline được re-inspect. Dùng qskill-executing-plans khi user yêu cầu execute plan đã duyệt. Không tự bắt đầu P6.2 từ file draft hoặc từ prompt batch.
