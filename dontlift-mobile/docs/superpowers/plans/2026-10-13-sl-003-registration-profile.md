# Kế hoạch triển khai P6.1 — SL-003: Đăng ký và hoàn tất profile

> **For agentic workers:** REQUIRED SUB-SKILL: Use the qskill-executing-plans skill to implement this plan task-by-task. Steps use checkbox tracking.
> Kế hoạch chỉ mô tả file, unit, hành vi, quy tắc, đầu ra và test cases; không có implementation code hoặc signatures. Đọc source thật trước mỗi task.
> **Gate:** Không execute kế hoạch khi trạng thái còn DRAFT hoặc khi blocker/dependency chưa giải quyết. Việc tạo file này không phê duyệt backlog hay P6.2.

**Mục tiêu:** Đăng ký và hoàn tất profile: Canonical profile đã lưu SQLite hoặc field error / retryable profile-completion.

**Slice:** SL-003. **Ưu tiên đề xuất:** P0. **Release:** MVP + activation/Premium; post-MVP deferred. SL-036 chỉ được tính release sau D6.

**Trạng thái kế hoạch:** APPROVED — human duyệt riêng execution SL-003 ngày 2026-10-14; D2 đã được giải quyết ở mức tài liệu.
**Approval evidence:** Human yêu cầu thực thi riêng SL-003 trên `feature/sl-003-registration-profile`, giữ nguyên scope/dependencies/acceptance/verification và dừng khi gặp blocker chưa duyệt; ngày 2026-10-14.
**Trạng thái implementation quan sát:** Registration boundary/UI và Functions/Rules đã được triển khai; unit, TypeScript và Emulator Suite đều pass. SL-003 chưa hoàn tất vì chưa xác minh flow và SQLite persistence trên Development Build Android; ADB daemon không khởi động được trong phiên Codex.
**Baseline khảo sát:** docs/p6.0-implementation-slices tại 57ca1eb28a2952c66d01f89b9b89bf755ab4812a.
**Ngày soạn:** 2026-10-13, Asia/Saigon.
**Plan slug:** `2026-10-13-sl-003-registration-profile`; mọi commit thực hiện plan này phải bắt đầu `[2026-10-13-sl-003-registration-profile]`.
**Đầu vào phạm vi:** Backlog P6.0 v0.1 trong cuộc trò chuyện ngày 2026-10-13, chưa được phê duyệt. User đã yêu cầu ghi draft P6.1 cho cả 37 slice; không suy thành approval thực thi.
**Traceability:** US-01; FS §1; UX §2; V01; ADR-001; [ADR-009](../../decisions/ADR-009-auth-profile-bootstrap.md); [API §8](../../api-contracts.md#8-completeregistrationprofile).
**Phụ thuộc bắt buộc:** [SL-002](./2026-10-13-sl-002-native-firebase-runtime.md)
**Ưu tiên mềm:** Theo thứ tự đề xuất trong [mục lục](../../implementation-plan.md); thứ tự không tạo thêm hard dependency.

## 1. Nguồn và ranh giới

Đọc [PRD](../../product-requirements.md), [Feature Spec](../../feature-specification.md), [Product Design](../../product-design.md), [Design Brief](../../product-design-brief.md), [Architecture](../../software-architecture.md), [API contracts](../../api-contracts.md), ADR áp dụng trong [decisions](../../decisions), cùng AGENTS ở app root. Tham chiếu cụ thể của slice nằm trong Traceability phía trên.

V01–V10 chỉ các màn tương ứng tại `design/concepts/concept-final/screens/`; prototype nằm tại `prototype/`. Chúng là read-only visual/interaction references, không chứng minh integration. Nếu journey không có design screen, trình bày gap với human trước quyết định UI mới.

**Kiến trúc:** registration controller và completeRegistrationProfile sở hữu hành vi của slice. Presentation đọc kết quả qua controller/repository; không tự trở thành nguồn authoritative. Units và đường dẫn mới bên dưới là đề xuất, chưa tồn tại trên baseline; nếu prerequisite đã tạo cùng trách nhiệm thì reuse, không thêm convention thứ hai.

**Stack:** Expo SDK 57 / React Native / TypeScript. SQLite cho local-first khi slice có persistence; React Native Firebase Auth/Firestore Standard/Functions cho boundary có Firebase. Không bắt slice thuần local phải có network.

**Không gồm:** SSO, reset password, email verification, editing profile hoặc deployment.

## 2. Blocker, risk và quyết định cần duyệt

- **D2 — đã giải quyết:** ADR-009 đã được human chấp thuận ngày 2026-10-06; nội dung ADR và wire contract `completeRegistrationProfile` đã được đưa vào baseline tại `docs/decisions/ADR-009-auth-profile-bootstrap.md` và `docs/api-contracts.md` §8. Không cần duyệt lại behavior đã chấp thuận. Nếu đối chiếu lúc thực thi phát hiện thay đổi behavior chưa được duyệt, dừng và xin quyết định riêng.

**Rủi ro cụ thể:** E1; không coi implementation/test evidence ở nhánh Auth là nghiệm thu của baseline hiện tại. Review report được track trên nhánh Auth chỉ có RC-001 về lint của Slice 0A; không có finding riêng cho registration trong các report đã kiểm tra. Không tái sử dụng Auth source code cho tới khi nó được review theo baseline hiện tại.

Nếu một contract chỉ có responsibility mà chưa có schema, task đầu là trình bày missing decision với nguồn; không tự tạo endpoint/field mới. Các hành vi test bên dưới mô tả outcome cần đạt, không thay thế wire approval. Ngưỡng/range/default chưa được spec xác định phải có quyết định ghi lại trước khi implement.

## 3. File và quyền sở hữu dự kiến

Các đường dẫn sau tương đối với `dontlift-mobile/`. Đọc lại trạng thái file lúc execute để chọn Create/Modify; không ghi đè implementation của dependency.

| File dự kiến | Trách nhiệm |
|---|---|
| `package.json` | SL-003 thêm expo-sqlite tương thích SDK thực tế và sở hữu thay đổi root manifest. |
| `package-lock.json` | Ownership cùng package.json: giữ đồng bộ npm dependency resolution khi manifest thay đổi, theo AGENTS. |
| `pnpm-lock.yaml` | Ownership cùng package.json: giữ đồng bộ pnpm dependency resolution; không commit một lockfile lệch manifest. |
| `src/features/local/database.ts` | SL-003 tạo database initialization dùng chung, lifecycle mở/đóng và readiness trước profile writes. |
| `src/features/local/migrations.ts` | SL-003 tạo versioned migration runner và profile migration sau D2; các slice sau thêm migration, không bootstrap lại. |
| `__tests__/local-database.test.ts` | Fresh open/reopen/migrate/rollback và preservation của dữ liệu profile. |
| `functions/package.json` | SL-003 sở hữu backend package tách biệt, supported Node engine, Functions/Admin SDK và dependencies Rules emulator testing. |
| `functions/package-lock.json` | Backend npm lockfile đồng bộ manifest; install chỉ ở execution được duyệt. |
| `functions/pnpm-lock.yaml` | Backend pnpm lockfile đồng bộ cùng dependency versions; không tạo workspace policy ngầm. |
| `functions/tests/runtime-bootstrap.test.cjs` | Backend module initialization/entrypoint test, không giả thay callable emulator evidence. |
| `functions/tests/helpers/rules-emulator.cjs` | Harness Rules Emulator Suite dùng isolated project namespace/fixture; không chạy nhầm live Firebase. |
| `firebase.emulator.json` | SL-003 thêm Functions source/runtime wiring sau khi backend package tồn tại; giữ host/region/config local của SL-002. |
| `firestore.emulator.rules` | SL-003 mở owner-only read trên `users/{uid}` trước profile fetch; giữ default deny với write và resource khác. SL-029 chỉ mở allowlisted profile edits trên nền Rules này. |
| `functions/tests/profile-owner-read.rules.emulator.test.cjs` | Client SDK Emulator Suite chứng minh owner read allowed, anonymous/cross-user read denied và entitlement/server-owned fields không thể bị client ghi. |
| `src/features/auth/auth-validation.ts` | Unit/repository/adapter chuyên trách; reuse nếu prerequisite đã tạo. |
| `src/features/auth/auth-controller.ts` | Unit/repository/adapter chuyên trách; reuse nếu prerequisite đã tạo. |
| `src/features/auth/local-profile-repository.ts` | Unit/repository/adapter chuyên trách; reuse nếu prerequisite đã tạo. |
| `src/screens/LoginScreen.tsx` | Presentation và states của journey; không chứa domain math/sync authority. |
| `functions/src/profile-contract.cjs` | Backend boundary của slice; server identity/validation/transaction. |
| `functions/index.js` | Backend boundary của slice; server identity/validation/transaction. |
| `__tests__/registration-profile.test.ts` | Kiểm thử dự kiến; chưa tạo test source trong P6.1. |
| `functions/tests/registration-profile.test.cjs` | Kiểm thử dự kiến; chưa tạo test source trong P6.1. |

**Unit:** registration controller và completeRegistrationProfile.
**Nhận:** Tên, email, password, confirmation và Auth-derived identity.
**Trả:** Canonical profile đã lưu SQLite hoặc field error / retryable profile-completion.
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

### Task 0A — SQLite foundation trước profile persistence

**Files:** package.json, package-lock.json, pnpm-lock.yaml, src/features/local/database.ts, src/features/local/migrations.ts, __tests__/local-database.test.ts.

**Unit:** local database initialization và migration runner. **Nhận:** database lifecycle, schema version và migrations thuộc slice đã duyệt. **Trả:** database ready cho profile repository hoặc lỗi không có partial profile write.

- [x] Xác nhận expo-sqlite version theo Expo SDK 57 thực tế; lập dependency change với cả hai root lockfiles, không dùng installed leftovers làm evidence.
- [x] Viết cases: fresh database tạo đúng schema; reopen giữ profile; migration đã áp dụng không chạy lại; migration lỗi rollback và không báo ready.
- [x] Chạy focused failing cases bằng harness SL-001; thiếu SQLite package không được tính là red nghiệp vụ.
- [x] Mở database qua một shared boundary; ghi migration version chỉ sau schema commit thành công.
- [x] Tạo profile schema theo ADR-009 đã được chấp thuận; không đưa token/password/entitlement vào profile table.
- [x] Profile upsert chỉ chạy sau readiness; init/migration/write lỗi giữ user ở retryable completion, không vào app giả.
- [ ] Reopen trên Development Build, kiểm tra profile còn và rollback bảo toàn data. Đồng bộ/kiểm tra root manifest và hai lockfiles.
- [x] Review task trước commit theo dated plan slug; không tạo domain session/outbox schema thuộc SL-006/007 trước scope của chúng.

### Task 0B — Backend Functions/Admin runtime trước callable

**Files:** functions/package.json, functions/package-lock.json, functions/pnpm-lock.yaml, functions/index.js, functions/tests/runtime-bootstrap.test.cjs, functions/tests/helpers/rules-emulator.cjs, firebase.emulator.json.

**Unit:** backend package bootstrap. **Nhận:** supported Functions runtime/SDK versions và local emulator configuration được duyệt. **Trả:** callable entrypoint load/discovery được và môi trường tests backend/Rules dùng được.

- [x] Chốt supported Node runtime 22, firebase-functions/firebase-admin versions và package-manager workflow. Không lấy runtime/config trên nhánh khác làm approval cho baseline.
- [x] Giữ backend package isolated và hai lockfiles đồng bộ; không thêm workspace package hay sửa root workspace policy.
- [x] Khởi tạo Admin app/database theo backend environment một lần; không copy service-account credentials vào repository hoặc hardcode project.
- [x] Kiểm thử module load/entrypoint discovery trong backend package; sau package bootstrap mới đăng ký completeRegistrationProfile.
- [x] Cấp Rules test dependencies/harness cho các slice đọc resource: fixtures authenticated/anonymous, isolated local namespace và host từ approved emulator config; không trỏ tới live project.
- [x] Cập nhật firebase.emulator.json trỏ Functions source/runtime thực tế. Chạy Auth/Firestore/Functions local integration sau prerequisites, gọi bootstrap với verified Auth context và thu evidence.
- [x] Thiếu package/runtime, thiếu emulator host hoặc emulator chưa chạy → test fail/setup blocker rõ; không skip silently hay ghi PASS.
- [x] Đồng bộ manifest/lockfiles backend và ghi exact commands/runtime/SDK trong evidence; code/dependency installation chỉ thuộc P6.2 đã duyệt.

**Output prerequisite:** Task 1/2 registration và các backend tests ở slice sau dùng bootstrap này. Native client initialization là output SL-002; server runtime và callable handshake là output SL-003.

### Task 0C — Owner-read profile Rules trước registration/login

**Files:** `firestore.emulator.rules`, `functions/tests/profile-owner-read.rules.emulator.test.cjs`, Rules harness từ Task 0B.

- [x] Mở chỉ authenticated owner read trên `users/{uid}` để SL-003/004 fetch canonical profile; không mở client create/update ngoài policy đã duyệt.
- [x] Dùng client SDK trên Emulator Suite: owner read allowed; anonymous/cross-user read denied; entitlement/server-owned fields không thể bị client sửa.
- [x] Chạy Rules cases trước registration/login integration; không dùng Admin SDK để chứng minh client authorization.
- [x] Giữ SL-029 là owner duy nhất của allowlisted profile edits và các update/immutable-field denial tests.

### Task 1 — Boundary và quy tắc của Đăng ký và hoàn tất profile

**Files:** Dùng units/config/backend/repositories trong bảng mục 3; khi test source đã được chỉ định, đặt cases thuộc boundary vào đúng app/backend target. Không thay presentation chưa cần cho task này.

**Nhận/trả:** Nhận Tên, email, password, confirmation và Auth-derived identity; trả Canonical profile đã lưu SQLite hoặc field error / retryable profile-completion. Implement đúng schema và behavior trong ADR-009/API §8; nếu source lúc execute có khác biệt chưa được duyệt thì dừng, ghi rõ evidence và xin quyết định thay vì tự mở rộng contract.

- [x] Đọc lại source/spec và xác nhận tất cả blocker cùng dependency cho task đã được giải quyết; nếu chưa, dừng execution và báo đúng blocker.
- [x] Viết focused cases sau đây; runner không tìm thấy hoặc thiếu dependency không được tính là red nghiệp vụ.

- [x] Confirmation không khớp → field error, không gọi network.
- [x] Email đã có → generic registration failure.
- [x] Bootstrap lỗi sau Auth success → retryable completion, không authenticated success.

- [x] Chạy focused command trong mục 7; runner thực thi tests đúng và pass, không phải toolchain failure.
- [x] Xây hành vi theo thứ tự sau, chỉ sau approval:

1. Áp dụng đúng ADR-009 và API §8 đã chấp thuận; không tự nghĩ thêm profile schema hoặc behavior bootstrap.
2. Validate tên/email/password/confirmation trước network; dùng generic duplicate-email error.
3. Tạo Auth account, set name, bootstrap profile create-only, rồi upsert local profile; không ghi token/password vào SQLite.

- [x] Chạy lại các cases và đối chiếu output/invariants; không tuyên bố native/integration PASS từ mock.
- [x] Review task và commit chỉ files thuộc task nếu execution được phép. Subject dùng `[2026-10-13-sl-003-registration-profile]`, trailer `Plan: docs/superpowers/plans/2026-10-13-sl-003-registration-profile.md` và `Task: 1`.

### Task 2 — Journey tích hợp và recovery

**Files:** Presentation/adapter/evidence trong mục 3 cùng boundary task 1; không refactor screen không liên quan. Task này không tạo implementation thứ hai cho unit task 1.

**Nhận:** Output task 1 đã kiểm chứng. **Trả:** Journey/bằng chứng có thể nghiệm thu; error/offline không false-success.

- [x] Viết các focused cases về integration/recovery sau; không viết tests chỉ mirror implementation.

- [x] SQLite lỗi → retry projection, không tạo tài khoản mới.
- [x] Replay cùng request/payload → cùng outcome; khác payload → collision error.
- [x] Profile có sẵn → không overwrite tên/quyền server.

- [x] Chạy focused checks, fixtures tách khỏi device evidence.
- [x] Tích hợp theo thứ tự:

1. Đưa form đúng email/password vào LoginScreen; loading khóa submit, lỗi field ở đúng vị trí.
2. Nếu Auth đã tạo nhưng bootstrap/local write lỗi, giữ user ở completion state; retry không gọi create account lần nữa.
3. Chỉ vào authenticated content khi server profile và local projection sẵn sàng; không để restore callback cũ đổi trạng thái mới.

- [ ] Thực hiện các kịch bản nghiệm thu trực tiếp trong mục 6; thu logs an toàn/device timestamps khi cần.
- [ ] Review kết quả; một branch fail hoặc thiếu required device/emulator evidence thì slice chưa hoàn thành.
- [ ] Commit task sau review nếu execution được phép. Subject dùng `[2026-10-13-sl-003-registration-profile]`, trailer `Plan: docs/superpowers/plans/2026-10-13-sl-003-registration-profile.md` và `Task: 2`.

### Acceptance bổ sung cho foundation

- [ ] Fresh database → profile schema và migration version ready trước registration upsert.
- [ ] Database reopen → profile cũ tồn tại; migration đã commit không chạy lần hai.
- [ ] Migration failure → schema/data rollback, retryable error; không authenticated success.
- [ ] Root package manifest thay đổi → package-lock.json và pnpm-lock.yaml đồng bộ.
- [ ] Backend manifest/lockfiles cùng supported runtime → entrypoint load và callable được emulator discovery.
- [ ] Auth/Functions/Firestore integration → verified UID, profile server/local và recovery được kiểm chứng; mock không thay evidence.
- [ ] Rules harness → anonymous/authenticated fixture test được trên local emulator, không live project.

## 6. Nghiệm thu và failure outcomes

- [ ] Confirmation không khớp → field error, không gọi network.
- [ ] Email đã có → generic registration failure.
- [ ] Bootstrap lỗi sau Auth success → retryable completion, không authenticated success.
- [ ] SQLite lỗi → retry projection, không tạo tài khoản mới.
- [ ] Replay cùng request/payload → cùng outcome; khác payload → collision error.
- [ ] Profile có sẵn → không overwrite tên/quyền server.
- [ ] Đăng ký trên Auth/Functions/Firestore emulators → đủ profile server/local.
- [ ] Ngắt Functions sau Auth creation rồi restart/retry → recovery đúng, một tài khoản.

Mỗi case phải có actual result. Unit cases dùng controlled fixtures để chứng minh domain; Firebase boundary cần Rules/Functions emulator tests cho allowed/denied/replay/concurrency khi áp dụng. Sensor/lifecycle cần physical devices. Không có evidence thì ghi UNVERIFIED và blocker, không tick PASS.

**Failure recovery bắt buộc:** không hiển thị successful save/transition khi commit/request chưa thành công; giữ dữ liệu/retry context theo hành vi cụ thể trong tasks. Không log email đầy đủ, token, activation code hoặc bank details. Case không áp dụng cho slice phải ghi lý do trong evidence, không bỏ im lặng.

## 7. Verification và ghi nhận evidence

Foundation focused tests sau Task 0A: `pnpm test --runTestsByPath __tests__/local-database.test.ts`. Backend bootstrap sau Task 0B: `node --test functions/tests/runtime-bootstrap.test.cjs`. Owner-read Rules cần Firestore Emulator Suite đang chạy: `node --test functions/tests/profile-owner-read.rules.emulator.test.cjs`. App focused tests sau khi SL-001 cấu hình runner: `pnpm test --runTestsByPath __tests__/registration-profile.test.ts`. Backend focused tests sau backend bootstrap SL-003 và native/emulator prerequisites SL-002: `node --test functions/tests/registration-profile.test.cjs`. TypeScript: `pnpm exec tsc --noEmit`. Lint: `pnpm run lint` chỉ khi repository có ESLint setup thực tế.

**Execution evidence — Task 0A, 2026-10-14:** `expo-sqlite ~57.0.4` matches Expo SDK 57; `pnpm install --offline --frozen-lockfile` and `npm install --package-lock-only --ignore-scripts --offline` both succeeded. The focused SQLite suite passed 3/3 cases (fresh schema, reopen/preservation/no rerun, rollback on migration failure); `pnpm exec tsc --noEmit` and `git diff --check` passed. The tests use Node's SQLite-backed fixture for migration semantics. Expo Development Build restart persistence remains UNVERIFIED until the profile flow is implemented and exercised on a device.

**Execution evidence — SL-003, 2026-10-14:** Root `expo-crypto ~57.0.4` supplies Expo's cross-platform cryptographically secure UUIDv4 generator for the approved callable request envelope; root npm/pnpm lockfiles are synchronized. Backend package is isolated with Node 22 target, Firebase Admin 14.5 / Functions 7.4 and both backend lockfiles. `node --test functions/tests/runtime-bootstrap.test.cjs` passed 1/1 under local Node 24.14.1; Firebase Emulator Suite Rules and registration suites passed 5/5 each using only `demo-dontlift-sl003` Auth/Firestore/Functions emulators. `pnpm exec tsc --noEmit` passed; `pnpm test --runTestsByPath __tests__/registration-profile.test.ts __tests__/local-database.test.ts --runInBand` passed 9/9 (validation, generic duplicate-email failure, bootstrap ordering/retry, SQLite retry, restored session without name, and migration/reopen/rollback). `pnpm install --frozen-lockfile --offline --ignore-scripts` passed. Emulator Functions used host Node 24.14.1 rather than target Node 22, so exact Node 22 execution remains UNVERIFIED. Device verification remains UNVERIFIED: `D:\platform-tools\adb.exe devices -l` could not start the ADB daemon in the Codex execution environment, so Development Build registration and restart persistence still require a device run. The earlier `pnpm dev` failure came from pnpm 11 attempting an install with ESLint dependencies outside SL-003; those unrelated dependencies and the generated `unrs-resolver` workspace placeholder were removed before lockfile synchronization.

Lệnh app chạy từ `dontlift-mobile/`; file paths tests/backend ở trên là planned targets. Command chỉ được chạy sau harness/dependency prerequisites. Native build/emulator commands phải lấy từ cấu hình thật sau SL-002; không đoán project ID, runtime hoặc production alias. Future schema/index changes được test với approved edition Standard.

Ghi trong kết quả execution: baseline/commit mới, command, exit status, số cases, emulator/device/runtime version, date, actual outcomes và remaining gaps. Các checklist hiện đều chưa chạy.

## 8. Human review và bàn giao P6.2

Human đã duyệt scope, non-goals, tasks, acceptance cases, dependencies và verification riêng của **SL-003** ngày 2026-10-14 (xem Approval evidence). Duyệt một slice không duyệt tất cả 37; duyệt authoring batch không duyệt code.

Sau approval, cập nhật trạng thái/date/decision evidence trong đúng plan; kế hoạch mới chỉ đủ execution-ready khi blocker đã được giải quyết và baseline được re-inspect. Dùng qskill-executing-plans khi user yêu cầu execute plan đã duyệt. Không tự bắt đầu slice khác từ file draft hoặc từ prompt batch.
