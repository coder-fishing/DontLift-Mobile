# Kế hoạch triển khai P6.1 — SL-030: Settings cho haptic và sound

> **For agentic workers:** REQUIRED SUB-SKILL: Use the qskill-executing-plans skill to implement this plan task-by-task. Steps use checkbox tracking.
> Kế hoạch chỉ mô tả file, unit, hành vi, quy tắc, đầu ra và test cases; không có implementation code hoặc signatures. Đọc source thật trước mỗi task.
> **Gate:** Không execute kế hoạch khi trạng thái còn DRAFT hoặc khi blocker/dependency chưa giải quyết. Việc tạo file này không phê duyệt backlog hay P6.2.

**Mục tiêu:** Settings cho haptic và sound: Persisted settings, capability-aware feedback không đổi scoring.

**Slice:** SL-030. **Ưu tiên đề xuất:** P1. **Release:** MVP + activation/Premium; post-MVP deferred. SL-036 chỉ được tính release sau D6.

**Trạng thái kế hoạch:** DRAFT — chưa được human duyệt; bị chặn bởi D11.
**Trạng thái implementation quan sát:** Không settings persistence/controller. Chưa có evidence nghiệm thu slice.
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

- **D11:** Duyệt default sound state, bundled alert asset và user scope của local preferences trước khi chốt giá trị mặc định hoặc tạo audio asset.

**Rủi ro cụ thể:** Default sound behavior/asset và local user scope phải chốt khi duyệt.

Nếu một contract chỉ có responsibility mà chưa có schema, task đầu là trình bày missing decision với nguồn; không tự tạo endpoint/field mới. Các hành vi test bên dưới mô tả outcome cần đạt, không thay thế wire approval. Ngưỡng/range/default chưa được spec xác định phải có quyết định ghi lại trước khi implement.

## 3. File và quyền sở hữu dự kiến

Các đường dẫn sau tương đối với `dontlift-mobile/`. Đọc lại trạng thái file lúc execute để chọn Create/Modify; không ghi đè implementation của dependency.

| File dự kiến | Trách nhiệm |
|---|---|
| `src/features/settings/settings-repository.ts` | Unit/repository/adapter chuyên trách; reuse nếu prerequisite đã tạo. |
| `src/features/settings/feedback-service.ts` | Unit/repository/adapter chuyên trách; reuse nếu prerequisite đã tạo. |
| `src/screens/SettingsScreen.tsx` | SL-030 tạo màn hình Settings nền cho feedback preferences; các slice sau mở rộng màn hiện có, không tạo màn Settings thứ hai. |
| `src/app/index.tsx` | Đăng ký Settings screen state, render màn hình, và chỉ cho app shell đã xác thực điều hướng vào Settings. |
| `src/types.ts` | Bổ sung định danh Settings vào ScreenId dùng chung. |
| `src/constants.ts` | Bổ sung tiêu đề Settings theo ScreenId. |
| `src/components/Header.tsx` | Nối nút cài đặt của app shell đã xác thực tới SettingsScreen; không dùng prototype control deck làm đường sản phẩm. |
| `src/features/local/migrations.ts` | SL-030 mở rộng migration runner SL-003 bằng versioned `app_settings` schema theo Feature Specification; không tạo database bootstrap thứ hai. |
| `package.json` | SL-030 sở hữu chọn và khai báo audio package tương thích Expo SDK/native targets sau khi D11 được duyệt. |
| `package-lock.json`, `pnpm-lock.yaml` | SL-030 sở hữu cập nhật đồng bộ hai lockfile nếu thêm audio package. |
| `app.json` | SL-030 sở hữu native/plugin configuration nếu audio package được chọn yêu cầu; chỉ cấu hình sau khi xác minh tương thích. |
| `assets/audio/violation-alert.wav` | Bundled violation cue do SL-030 sở hữu; nội dung/default chỉ được chốt sau D11. |
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

**Nhận/trả:** Nhận User preference haptic/sound và confirmed violation; trả Persisted settings, capability-aware feedback không đổi scoring. Với contract đang bị chặn, chưa có quyền thêm schema dù test outcome đã được nêu.

- [ ] Đọc lại source/spec và xác nhận tất cả blocker cùng dependency cho task đã được giải quyết; nếu chưa, dừng execution và báo đúng blocker.
- [ ] Viết focused failing cases sau đây; runner không tìm thấy hoặc thiếu dependency không được tính là red nghiệp vụ.

- [ ] Haptic off → confirmed violation không vibrate.
- [ ] Haptic on và supported → phát một feedback.
- [ ] Sound off → không âm thanh.
- [ ] Fresh install → app_settings schema được tạo trước khi lưu preferences.
- [ ] Upgrade từ profile/session schema → app_settings schema được thêm, dữ liệu hiện có được giữ.
- [ ] Authenticated app shell → nút cài đặt mở SettingsScreen; unauthenticated user không vào được Settings route.
- [ ] Sound on, confirmed violation, supported device → bundled cue phát theo D11; unsupported audio không ngăn violation được lưu.

- [ ] Chạy focused command trong mục 7; xác nhận failure đúng behavior đang thiếu, không từ toolchain lỗi.
- [ ] Xây hành vi theo thứ tự sau, chỉ sau approval:

1. Đọc settings local trước feedback; persist changes theo current-user/settings scope được duyệt.
2. Khi database mở, chạy `app_settings` migration sau schema SL-003; settings repository không báo saved trước khi commit.
3. Settings entry chỉ hiện trong authenticated app shell và mở SettingsScreen qua navigation state/entrypoint được sở hữu tại đây.
4. Confirmed event mới phát haptic khi enabled/capability; sound theo toggle và asset đã duyệt.
5. Unsupported feedback không làm engine crash hoặc đổi score/grace.

- [ ] Chạy lại các cases và đối chiếu output/invariants; không tuyên bố native/integration PASS từ mock.
- [ ] Review task và commit chỉ files thuộc task nếu execution được phép. Subject dùng `[2026-10-13-sl-030-feedback-settings]`, trailer `Plan: docs/superpowers/plans/2026-10-13-sl-030-feedback-settings.md` và `Task: 1`.

### Task 2 — Journey tích hợp và recovery

**Files:** Presentation/adapter/evidence trong mục 3 cùng boundary task 1; không refactor screen không liên quan. Task này không tạo implementation thứ hai cho unit task 1.

**Nhận:** Output task 1 đã kiểm chứng. **Trả:** Journey/bằng chứng có thể nghiệm thu; error/offline không false-success.

- [ ] Viết các failing cases về integration/recovery sau; không viết tests chỉ mirror implementation.

- [ ] Restart → giữ persisted flags.
- [ ] Unsupported haptic → engine vẫn ghi violation.
- [ ] Write fail → không false saved.

- [ ] Chạy focused checks, xác nhận failure đúng behavior; giữ fixtures tách khỏi device evidence.
- [ ] Tích hợp theo thứ tự:

1. Expose enabled/disabled states bằng native semantics; restart giữ lựa chọn.
2. Sound package/native setup và bundled cue chỉ được thêm sau D11; manifest và lockfiles được cập nhật đồng bộ.
3. SQLite write fail → error/retry, UI không công bố persisted nếu chưa commit.
4. Settings không cần network; không render quảng cáo trong active-session route.

- [ ] Thực hiện các kịch bản nghiệm thu trực tiếp trong mục 6; thu logs an toàn/device timestamps khi cần.
- [ ] Review kết quả; một branch fail hoặc thiếu required device/emulator evidence thì slice chưa hoàn thành.
- [ ] Commit task sau review nếu execution được phép. Subject dùng `[2026-10-13-sl-030-feedback-settings]`, trailer `Plan: docs/superpowers/plans/2026-10-13-sl-030-feedback-settings.md` và `Task: 2`.

## 6. Nghiệm thu và failure outcomes

- [ ] Haptic off → confirmed violation không vibrate.
- [ ] Haptic on và supported → phát một feedback.
- [ ] Sound off → không âm thanh.
- [ ] Restart → giữ persisted flags.
- [ ] Unsupported haptic → engine vẫn ghi violation.
- [ ] Write fail → không false saved.
- [ ] Fresh install và upgrade → migration app_settings chạy, preferences cũ được giữ.
- [ ] Authenticated user mở Settings từ app shell; unauthenticated user không truy cập được screen.
- [ ] Physical device toggles rồi lift thật → feedback theo lựa chọn.
- [ ] Sound enabled trên Android/iOS → cue được phát khi confirmed violation; sound disabled/unsupported → không phát, violation vẫn được ghi.
- [ ] Offline toggle/restart → settings còn.

Mỗi case phải có actual result. Unit cases dùng controlled fixtures để chứng minh domain; Firebase boundary cần Rules/Functions emulator tests cho allowed/denied/replay/concurrency khi áp dụng. Sensor/lifecycle cần physical devices. Không có evidence thì ghi UNVERIFIED và blocker, không tick PASS.

**Failure recovery bắt buộc:** không hiển thị successful save/transition khi commit/request chưa thành công; giữ dữ liệu/retry context theo hành vi cụ thể trong tasks. Không log email đầy đủ, token, activation code hoặc bank details. Case không áp dụng cho slice phải ghi lý do trong evidence, không bỏ im lặng.

## 7. Verification và ghi nhận evidence

App focused tests sau khi SL-001 cấu hình runner: `pnpm test --runTestsByPath __tests__/feedback-settings.test.ts`. Migration cases chạy cùng test file trên fresh schema và upgrade fixture. TypeScript: `pnpm exec tsc --noEmit`. Lint: `pnpm run lint` chỉ khi repository có ESLint setup thực tế.

Lệnh app chạy từ `dontlift-mobile/`; file paths tests/backend ở trên là planned targets. Command chỉ được chạy sau harness/dependency prerequisites. Native build/emulator commands phải lấy từ cấu hình thật sau SL-002; không đoán project ID, runtime hoặc production alias. Future schema/index changes được test với approved edition Standard.

Ghi trong kết quả execution: baseline/commit mới, command, exit status, số cases, emulator/device/runtime version, date, actual outcomes và remaining gaps. Các checklist hiện đều chưa chạy.

## 8. Human review và bàn giao P6.2

Human phải duyệt scope, non-goals, tasks, acceptance cases, dependencies và các quyết định còn mở của **SL-030** trước implementation. Duyệt một slice không duyệt tất cả 37; duyệt authoring batch không duyệt code.

Sau approval, cập nhật trạng thái/date/decision evidence trong đúng plan; kế hoạch mới chỉ đủ execution-ready khi blocker đã được giải quyết và baseline được re-inspect. Dùng qskill-executing-plans khi user yêu cầu execute plan đã duyệt. Không tự bắt đầu P6.2 từ file draft hoặc từ prompt batch.
