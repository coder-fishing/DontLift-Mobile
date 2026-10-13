# Kế hoạch triển khai P6.1 — SL-037: Nghiệm thu MVP và phát hành đúng environment

> **For agentic workers:** REQUIRED SUB-SKILL: Use the qskill-executing-plans skill to implement this plan task-by-task. Steps use checkbox tracking.
> Kế hoạch chỉ mô tả file, unit, hành vi, quy tắc, đầu ra và test cases; không có implementation code hoặc signatures. Đọc source thật trước mỗi task.
> **Gate:** Không execute kế hoạch khi trạng thái còn DRAFT hoặc khi blocker/dependency chưa giải quyết. Việc tạo file này không phê duyệt backlog hay P6.2.

**Mục tiêu:** Nghiệm thu MVP và phát hành đúng environment: Reviewable release evidence hoặc exact blocker, không deploy tự động.

**Slice:** SL-037. **Ưu tiên đề xuất:** P1. **Release:** MVP + activation/Premium; post-MVP deferred. SL-036 chỉ được tính release sau D6.

**Trạng thái kế hoạch:** DRAFT — chưa được human duyệt; bị chặn bởi D1, D6, E1, E2, E3.
**Trạng thái implementation quan sát:** Chưa có device/emulator/release evidence. Chưa có evidence nghiệm thu slice.
**Baseline khảo sát:** docs/p6.0-implementation-slices tại 57ca1eb28a2952c66d01f89b9b89bf755ab4812a.
**Ngày soạn:** 2026-10-13, Asia/Saigon.
**Plan slug:** `2026-10-13-sl-037-mvp-release`; mọi commit thực hiện plan này phải bắt đầu `[2026-10-13-sl-037-mvp-release]`.
**Đầu vào phạm vi:** Backlog P6.0 v0.1 trong cuộc trò chuyện ngày 2026-10-13, chưa được phê duyệt. User đã yêu cầu ghi draft P6.1 cho cả 37 slice; không suy thành approval thực thi.
**Traceability:** NFR; SC-1–SC-5; ARCH §11/15; ADR-006.
**Phụ thuộc bắt buộc:** [SL-001](./2026-10-13-sl-001-test-foundation.md), [SL-002](./2026-10-13-sl-002-native-firebase-runtime.md), [SL-003](./2026-10-13-sl-003-registration-profile.md), [SL-004](./2026-10-13-sl-004-login-session.md), [SL-005](./2026-10-13-sl-005-sensor-availability.md), [SL-006](./2026-10-13-sl-006-solo-start.md), [SL-007](./2026-10-13-sl-007-foreground-detection.md), [SL-008](./2026-10-13-sl-008-solo-completion.md), [SL-009](./2026-10-13-sl-009-android-recovery.md), [SL-010](./2026-10-13-sl-010-ios-recovery.md), [SL-011](./2026-10-13-sl-011-solo-sync.md), [SL-012](./2026-10-13-sl-012-solo-history.md), [SL-013](./2026-10-13-sl-013-room-create.md), [SL-014](./2026-10-13-sl-014-room-join-pin.md), [SL-015](./2026-10-13-sl-015-room-join-qr.md), [SL-016](./2026-10-13-sl-016-room-lobby-start.md), [SL-017](./2026-10-13-sl-017-group-active.md), [SL-018](./2026-10-13-sl-018-early-exit.md), [SL-019](./2026-10-13-sl-019-termination-vote.md), [SL-020](./2026-10-13-sl-020-room-completion.md), [SL-021](./2026-10-13-sl-021-host-finalization-override.md), [SL-022](./2026-10-13-sl-022-stale-room-abort.md), [SL-023](./2026-10-13-sl-023-settlement-details.md), [SL-024](./2026-10-13-sl-024-default-bill.md), [SL-025](./2026-10-13-sl-025-bill-overrides.md), [SL-026](./2026-10-13-sl-026-vietqr-payment.md), [SL-027](./2026-10-13-sl-027-manual-payment-status.md), [SL-028](./2026-10-13-sl-028-group-history.md), [SL-029](./2026-10-13-sl-029-profile-edit.md), [SL-030](./2026-10-13-sl-030-feedback-settings.md), [SL-031](./2026-10-13-sl-031-local-premium.md), [SL-032](./2026-10-13-sl-032-server-premium.md), [SL-033](./2026-10-13-sl-033-retention.md), [SL-034](./2026-10-13-sl-034-premium-themes.md), [SL-035](./2026-10-13-sl-035-free-tier-ads.md), [SL-036](./2026-10-13-sl-036-advanced-leaderboard.md)
**Ưu tiên mềm:** Theo thứ tự đề xuất trong [mục lục](../../implementation-plan.md); thứ tự không tạo thêm hard dependency.

## 1. Nguồn và ranh giới

Đọc [PRD](../../product-requirements.md), [Feature Spec](../../feature-specification.md), [Product Design](../../product-design.md), [Design Brief](../../product-design-brief.md), [Architecture](../../software-architecture.md), [API contracts](../../api-contracts.md), ADR áp dụng trong [decisions](../../decisions), cùng AGENTS ở app root. Tham chiếu cụ thể của slice nằm trong Traceability phía trên.

V01–V10 chỉ các màn tương ứng tại `design/concepts/concept-final/screens/`; prototype nằm tại `prototype/`. Chúng là read-only visual/interaction references, không chứng minh integration. Nếu journey không có design screen, trình bày gap với human trước quyết định UI mới.

**Kiến trúc:** release verification gate sở hữu hành vi của slice. Presentation đọc kết quả qua controller/repository; không tự trở thành nguồn authoritative. Units và đường dẫn mới bên dưới là đề xuất, chưa tồn tại trên baseline; nếu prerequisite đã tạo cùng trách nhiệm thì reuse, không thêm convention thứ hai.

**Stack:** Expo SDK 57 / React Native / TypeScript. SQLite cho local-first khi slice có persistence; React Native Firebase Auth/Firestore Standard/Functions cho boundary có Firebase. Không bắt slice thuần local phải có network.

**Không gồm:** Feature implementation, tự bật billing/deploy, đổi backend hoặc store publication ngoài authorization.

## 2. Blocker, risk và quyết định cần duyệt

- **D1:** Thống nhất tiếp nhận quyết định emulator/dev từ feature/registration-login; xác nhận environment/config và production vẫn riêng. Không provision/deploy khi chưa được cấp quyền.
- **E1:** Cần Development Build, Android/iOS physical devices, toolchains và Emulator Suite để có native/integration evidence.
- **E2:** Cloud release cần projects/config/billing/scheduled jobs được human cho phép; P6.1 authoring không deploy.
- **E3:** Cần VietQR provider/format và năm banking apps trong cohort để kiểm chứng QR thật.

**Rủi ro cụ thể:** E1/E2/E3; SC-5 là cohort outcome, không thay bằng unit-test success.

Nếu một contract chỉ có responsibility mà chưa có schema, task đầu là trình bày missing decision với nguồn; không tự tạo endpoint/field mới. Các hành vi test bên dưới mô tả outcome cần đạt, không thay thế wire approval. Ngưỡng/range/default chưa được spec xác định phải có quyết định ghi lại trước khi implement.

## 3. File và quyền sở hữu dự kiến

Các đường dẫn sau tương đối với `dontlift-mobile/`. Đọc lại trạng thái file lúc execute để chọn Create/Modify; không ghi đè implementation của dependency.

| File dự kiến | Trách nhiệm |
|---|---|
| `.firebaserc` | SL-037 tạo aliases development/production từ exact project IDs đã được human xác nhận, không placeholder hoặc cùng project. |
| `firebase.json` | SL-037 tạo canonical deployment wiring cho Rules/indexes/Functions source/runtime; không lấy emulator config làm production config ngầm. |
| `firestore.rules` | SL-037 tiếp nhận policy đã kiểm chứng từ firestore.emulator.rules và re-test đúng canonical file; không tự redesign quyền. |
| `firestore.indexes.json` | SL-037 sở hữu index manifest từ query inventory các slice đã nghiệm thu; validate queries trên approved dev environment. |
| `docs/firebase-deployment.md` | SL-037 hướng dẫn explicit aliases/environment, config validation/deploy order/smoke, Firestore TTL policy cho `users/{uid}/syncReceipts` (`expiresAt` field, D10-approved horizon) và enablement/verification qua supported Firestore tooling per authorized database; không credentials hoặc scheduled cleanup thay TTL. |
| `functions/package.json` | Reuse bootstrap SL-003; kiểm tra engine/region/source compatibility, không bootstrap backend thứ hai. |
| `docs/query-index-inventory.md` | Ghi query owner, filters/order/cursor, index requirements và verification evidence từ từng slice; không đoán indexes. |
| `functions/tests/deployment-config.test.cjs` | Config validation/alias separation và missing-prerequisite failures, không deploy trong test. |
| `docs/release-verification.md` | Evidence hoặc hướng dẫn thực thi sau approval; không được ghi claimed pass thiếu bằng chứng. |
| `docs/software-architecture.md` | Evidence hoặc hướng dẫn thực thi sau approval; không được ghi claimed pass thiếu bằng chứng. |
| `eas.json` | Configuration theo quyền và version thực tế; đọc trước chỉnh. |

**Unit:** release verification gate.
**Nhận:** Approved plans, completed-slice evidence, environment/billing authorization và signed-build prerequisites.
**Trả:** Reviewable release evidence hoặc exact blocker, không deploy tự động.
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

### Task 0 — Ownership config deferred và permission gates

**Files:** .firebaserc, firebase.json, firestore.rules, firestore.indexes.json, docs/firebase-deployment.md, docs/query-index-inventory.md và functions/tests/deployment-config.test.cjs.

**Nhận:** exact dev/prod projects được xác nhận, D1/E2 đã giải quyết, tested Rules/backend và query inventory. **Trả:** deployment config có thể review/validate; riêng việc chuẩn bị config không cho phép deploy.

- [ ] Xác nhận hai exact project IDs/aliases và authorized environment/billing/jobs trước tạo executable deferred config; không ghi placeholder hoặc tạo resources để lấp prerequisite.
- [ ] Tạo .firebaserc aliases development/production khác project; chọn environment rõ cho mọi command. Không default production hoặc secret/config material trong Git.
- [ ] Tạo firebase.json với canonical Rules/index paths và Functions source/runtime đã có từ SL-003; xác nhận region theo adapter/backend, không invent runtime.
- [ ] Tiếp nhận firestore.emulator.rules vào firestore.rules có traceability theo owner SL-012/016/017/018/019/023/024/029/036; re-run mọi resource Rules suite với chính canonical policy, không giữ hai policies lệch nhau. D3/D6 resource nào chưa được duyệt thì giữ blocker, không thêm policy đoán.
- [ ] Thu query inventory từ history/room/member/bill/settlement listeners; tạo index manifest chỉ cho query thật và validate trên approved development database khi có quyền.
- [ ] Sau D10 approval, cấu hình Firestore TTL cho collection group `syncReceipts` trên field `expiresAt` bằng supported Google Cloud Console/gcloud tooling; xác nhận policy applied trên đúng authorized database/environment và ghi evidence trong `docs/firebase-deployment.md`. Không đặt TTL declaration vào `firestore.indexes.json` hoặc thêm receipt purge Function.
- [ ] Chạy config tests: missing IDs → blocker; same dev/prod project → reject; missing source/rules/index path hoặc unsupported runtime → reject; deployment target production khi chưa authorized → reject.
- [ ] Emulator validation/config review xong vẫn chưa deploy. Chỉ sau quyền deploy cụ thể mới thực hiện Rules → indexes → Functions → scheduled jobs/TTL → backend smoke → binary theo ADR-006.
- [ ] Development smoke pass và production authorization là gate riêng trước production deployment/build. Lưu exact environment/config/revision/results, không fake PASS.
- [ ] Không sửa approved architecture decision; docs/software-architecture.md chỉ cập nhật evidence provisioning đã xảy ra khi được phép, không dùng plan correction để bỏ deferred gates.

### Task 1 — Xác nhận đầu vào và gate nghiệp vụ

**Files:** Dùng units/config/backend/repositories trong bảng mục 3; khi test source đã được chỉ định, đặt cases thuộc boundary vào đúng app/backend target. Không thay presentation chưa cần cho task này.

**Nhận/trả:** Nhận Approved plans, completed-slice evidence, environment/billing authorization và signed-build prerequisites; trả Reviewable release evidence hoặc exact blocker, không deploy tự động. Với contract đang bị chặn, chưa có quyền thêm schema dù test outcome đã được nêu.

- [ ] Đọc lại source/spec và xác nhận tất cả blocker cùng dependency cho task đã được giải quyết; nếu chưa, dừng execution và báo đúng blocker.
- [ ] Kiểm chứng gate bằng evidence/decision đã duyệt; không viết implementation test giả.

- [ ] Thiếu slice evidence → release gate fail rõ.
- [ ] Development config trỏ production → reject.
- [ ] Sensor chỉ mocked → không pass device gate.

- [ ] Đối chiếu từng case với approval/evidence, ghi gap trước khi tiến hành.
- [ ] Xây hành vi theo thứ tự sau, chỉ sau approval:

1. Kiểm tất cả slice MVP đã nghiệm thu, gồm hard dependency SL-036; D6 chưa chốt thì release gate BLOCKED.
2. Xác nhận dev/prod projects riêng, native file variables và region; không expose secrets.
3. Backend Rules/indexes/Functions/jobs/smoke phải đạt gate trước binary theo deployment contract.

- [ ] Chạy lại các cases và đối chiếu output/invariants; không tuyên bố native/integration PASS từ mock.
- [ ] Review task và commit chỉ files thuộc task nếu execution được phép. Subject dùng `[2026-10-13-sl-037-mvp-release]`, trailer `Plan: docs/superpowers/plans/2026-10-13-sl-037-mvp-release.md` và `Task: 1`.

### Task 2 — Hoàn tất review và bằng chứng

**Files:** Presentation/adapter/evidence trong mục 3 cùng boundary task 1; không refactor screen không liên quan. Task này không tạo implementation thứ hai cho unit task 1.

**Nhận:** Output task 1 đã kiểm chứng. **Trả:** Journey/bằng chứng có thể nghiệm thu; error/offline không false-success.

- [ ] Chuẩn bị checklist review/smoke từ evidence thật; unresolved scope vẫn giữ DRAFT/BLOCKED.

- [ ] Thiếu bank cohort → SC-4 unverified.
- [ ] Bill property mismatch → stop release.
- [ ] Chưa authorized billing/deploy → không chạy mutation.

- [ ] Chỉ chạy check được authorized và có runtime; nếu chưa có, ghi missing evidence.
- [ ] Tích hợp theo thứ tự:

1. Thực hiện native journeys Android/iOS, offline/restart/reconnect/retry/duplicate-delivery protocol.
2. Thu cohort evidence stationary false positives dưới 2%, sync eventual delivery, leaderboard latency không quá 2 giây, bill zero discrepancy và năm banking apps.
3. Record group completion rate trên 85%; nếu chưa cohort/data không claim pass; packaging/deploy cần user approval riêng.

- [ ] Thực hiện các kịch bản nghiệm thu trực tiếp trong mục 6; thu logs an toàn/device timestamps khi cần.
- [ ] Review kết quả; một branch fail hoặc thiếu required device/emulator evidence thì slice chưa hoàn thành.
- [ ] Commit task sau review nếu execution được phép. Subject dùng `[2026-10-13-sl-037-mvp-release]`, trailer `Plan: docs/superpowers/plans/2026-10-13-sl-037-mvp-release.md` và `Task: 2`.

### Acceptance deployment configuration

- [ ] Exact IDs chưa xác nhận hoặc thiếu quyền → stop trước executable config/provision/deploy.
- [ ] Dev/prod aliases khác project và mọi deployment command có explicit target.
- [ ] Canonical config trỏ Rules/indexes/Functions source/runtime tồn tại, đã validate.
- [ ] Rules canonical tương đương policy đã test; owner/member/outsider/direct-write cases được chạy lại.
- [ ] Các room subcollection direct reads có owner slice/test tương ứng; server-only paths vẫn deny client read/write.
- [ ] Thiếu nghiệm thu SL-036 hoặc unresolved D6 → release gate BLOCKED.
- [ ] Index inventory trace tới query thật; emulator pass không được dùng để claim production indexes đã deploy.
- [ ] Deploy order và smoke gates đúng ADR-006; missing billing/jobs/permission là BLOCKED, không tự xử lý bằng mutation.

## 6. Nghiệm thu và failure outcomes

- [ ] Thiếu slice evidence → release gate fail rõ.
- [ ] Development config trỏ production → reject.
- [ ] Sensor chỉ mocked → không pass device gate.
- [ ] Thiếu bank cohort → SC-4 unverified.
- [ ] Bill property mismatch → stop release.
- [ ] Chưa authorized billing/deploy → không chạy mutation.
- [ ] Reviewer đọc evidence ledger → mỗi pass có command/device/date/result.
- [ ] Signed build approved environment chạy end-to-end → exact version/runtime recorded.

Mỗi case phải có actual result. Unit cases dùng controlled fixtures để chứng minh domain; Firebase boundary cần Rules/Functions emulator tests cho allowed/denied/replay/concurrency khi áp dụng. Sensor/lifecycle cần physical devices. Không có evidence thì ghi UNVERIFIED và blocker, không tick PASS.

**Failure recovery bắt buộc:** không hiển thị successful save/transition khi commit/request chưa thành công; giữ dữ liệu/retry context theo hành vi cụ thể trong tasks. Không log email đầy đủ, token, activation code hoặc bank details. Case không áp dụng cho slice phải ghi lý do trong evidence, không bỏ im lặng.

## 7. Verification và ghi nhận evidence

Sau backend bootstrap SL-003, config-only focused check: `node --test functions/tests/deployment-config.test.cjs`. Emulator/deploy/smoke commands phải được ghi từ actual reviewed firebase.json, exact IDs và explicit alias sau authorization; kiểm tra config không tự gọi deploy. Không invent execution result khi chỉ sửa plan.

Chạy lại các focused tests và emulator/device protocols của slice đã duyệt; không viết test giả để biến checklist release thành PASS.

Lệnh app chạy từ `dontlift-mobile/`; file paths tests/backend ở trên là planned targets. Command chỉ được chạy sau harness/dependency prerequisites. Native build/emulator commands phải lấy từ cấu hình thật sau SL-002; không đoán project ID, runtime hoặc production alias. Future schema/index changes được test với approved edition Standard.

Ghi trong kết quả execution: baseline/commit mới, command, exit status, số cases, emulator/device/runtime version, date, actual outcomes và remaining gaps. Các checklist hiện đều chưa chạy.

## 8. Human review và bàn giao P6.2

Human phải duyệt scope, non-goals, tasks, acceptance cases, dependencies và các quyết định còn mở của **SL-037** trước implementation. Duyệt một slice không duyệt tất cả 37; duyệt authoring batch không duyệt code.

Sau approval, cập nhật trạng thái/date/decision evidence trong đúng plan; kế hoạch mới chỉ đủ execution-ready khi blocker đã được giải quyết và baseline được re-inspect. Dùng qskill-executing-plans khi user yêu cầu execute plan đã duyệt. Không tự bắt đầu P6.2 từ file draft hoặc từ prompt batch.
