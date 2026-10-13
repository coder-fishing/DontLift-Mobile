# Kế hoạch triển khai P6.1 — SL-012: Xem Solo history

> **For agentic workers:** REQUIRED SUB-SKILL: Use the qskill-executing-plans skill to implement this plan task-by-task. Steps use checkbox tracking.
> Kế hoạch chỉ mô tả file, unit, hành vi, quy tắc, đầu ra và test cases; không có implementation code hoặc signatures. Đọc source thật trước mỗi task.
> **Gate:** Không execute kế hoạch khi trạng thái còn DRAFT hoặc khi blocker/dependency chưa giải quyết. Việc tạo file này không phê duyệt backlog hay P6.2.

**Mục tiêu:** Xem Solo history: List/detail local-first, stable merge và pagination không duplicate.

**Slice:** SL-012. **Ưu tiên đề xuất:** P1. **Release:** MVP + activation/Premium; post-MVP deferred. SL-036 chỉ được tính release sau D6.

**Trạng thái kế hoạch:** DRAFT — chưa được human duyệt.
**Trạng thái implementation quan sát:** Chưa có history screen/repository. Chưa có evidence nghiệm thu slice.
**Baseline khảo sát:** docs/p6.0-implementation-slices tại 57ca1eb28a2952c66d01f89b9b89bf755ab4812a.
**Ngày soạn:** 2026-10-13, Asia/Saigon.
**Plan slug:** `2026-10-13-sl-012-solo-history`; mọi commit thực hiện plan này phải bắt đầu `[2026-10-13-sl-012-solo-history]`.
**Đầu vào phạm vi:** Backlog P6.0 v0.1 trong cuộc trò chuyện ngày 2026-10-13, chưa được phê duyệt. User đã yêu cầu ghi draft P6.1 cho cả 37 slice; không suy thành approval thực thi.
**Traceability:** US-16; ARCH §6.1/7.2; ADR-002.
**Phụ thuộc bắt buộc:** [SL-011](./2026-10-13-sl-011-solo-sync.md)
**Ưu tiên mềm:** Theo thứ tự đề xuất trong [mục lục](../../implementation-plan.md); thứ tự không tạo thêm hard dependency.

## 1. Nguồn và ranh giới

Đọc [PRD](../../product-requirements.md), [Feature Spec](../../feature-specification.md), [Product Design](../../product-design.md), [Design Brief](../../product-design-brief.md), [Architecture](../../software-architecture.md), [API contracts](../../api-contracts.md), ADR áp dụng trong [decisions](../../decisions), cùng AGENTS ở app root. Tham chiếu cụ thể của slice nằm trong Traceability phía trên.

V01–V10 chỉ các màn tương ứng tại `design/concepts/concept-final/screens/`; prototype nằm tại `prototype/`. Chúng là read-only visual/interaction references, không chứng minh integration. Nếu journey không có design screen, trình bày gap với human trước quyết định UI mới.

**Kiến trúc:** Solo history repository sở hữu hành vi của slice. Presentation đọc kết quả qua controller/repository; không tự trở thành nguồn authoritative. Units và đường dẫn mới bên dưới là đề xuất, chưa tồn tại trên baseline; nếu prerequisite đã tạo cùng trách nhiệm thì reuse, không thêm convention thứ hai.

**Stack:** Expo SDK 57 / React Native / TypeScript. SQLite cho local-first khi slice có persistence; React Native Firebase Auth/Firestore Standard/Functions cho boundary có Firebase. Không bắt slice thuần local phải có network.

**Không gồm:** Group history, analytics và physical purge thuộc 028/033.

## 2. Blocker, risk và quyết định cần duyệt

- Không có blocker riêng được xác nhận trong draft; dependency và quyền/runtime vẫn phải đạt gate trước thực thi.

**Rủi ro cụ thể:** Retention cutoff, large-list virtualization và stale snapshot.

Nếu một contract chỉ có responsibility mà chưa có schema, task đầu là trình bày missing decision với nguồn; không tự tạo endpoint/field mới. Các hành vi test bên dưới mô tả outcome cần đạt, không thay thế wire approval. Ngưỡng/range/default chưa được spec xác định phải có quyết định ghi lại trước khi implement.

## 3. File và quyền sở hữu dự kiến

Các đường dẫn sau tương đối với `dontlift-mobile/`. Đọc lại trạng thái file lúc execute để chọn Create/Modify; không ghi đè implementation của dependency.

| File dự kiến | Trách nhiệm |
|---|---|
| `firestore.emulator.rules` | SL-012 mở rộng local Rules bằng owner-scoped Solo history reads, giữ deny client authoritative writes. |
| `functions/tests/solo-history-rules.emulator.test.cjs` | Rules integration cases theo resource, dùng harness/dependencies backend SL-003 và Emulator Suite; no runtime install trong P6.1. |
| `src/features/history/solo-history-repository.ts` | Unit/repository/adapter chuyên trách; reuse nếu prerequisite đã tạo. |
| `src/features/history/history-controller.ts` | Unit/repository/adapter chuyên trách; reuse nếu prerequisite đã tạo. |
| `src/screens/HistoryScreen.tsx` | Presentation và states của journey; không chứa domain math/sync authority. |
| `src/app/index.tsx` | Unit/repository/adapter chuyên trách; reuse nếu prerequisite đã tạo. |
| `__tests__/solo-history.test.ts` | Kiểm thử dự kiến; chưa tạo test source trong P6.1. |
| `functions/tests/solo-history.test.cjs` | Kiểm thử dự kiến; chưa tạo test source trong P6.1. |

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

SL-012 sở hữu mở rộng firestore.emulator.rules cho owner path users/{uid}/sessions, và functions/tests/solo-history-rules.emulator.test.cjs. Reuse local config SL-002 cùng Rules harness SL-003 từ dependency chain; chưa có thì dừng cloud integration.

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

- [ ] Chạy focused checks, xác nhận failure đúng behavior; giữ fixtures tách khỏi device evidence.
- [ ] Tích hợp theo thứ tự:

1. Có loading/empty/error/cached/syncing state và retry; không dùng mock stats.
2. Detail đủ date/duration/lift count/violation duration/score; list không tạo duplicate khi page overlap.
3. Changing user hủy listeners và pagination cũ; không leak history.

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
- [ ] Complete vài session, offline mở list/detail → dữ liệu thật.
- [ ] Cloud fills gaps → list merge đúng, order không nhảy ngẫu nhiên.

Mỗi case phải có actual result. Unit cases dùng controlled fixtures để chứng minh domain; Firebase boundary cần Rules/Functions emulator tests cho allowed/denied/replay/concurrency khi áp dụng. Sensor/lifecycle cần physical devices. Không có evidence thì ghi UNVERIFIED và blocker, không tick PASS.

**Failure recovery bắt buộc:** không hiển thị successful save/transition khi commit/request chưa thành công; giữ dữ liệu/retry context theo hành vi cụ thể trong tasks. Không log email đầy đủ, token, activation code hoặc bank details. Case không áp dụng cho slice phải ghi lý do trong evidence, không bỏ im lặng.

## 7. Verification và ghi nhận evidence

Rules integration trước cloud history: `node --test functions/tests/solo-history-rules.emulator.test.cjs` bên trong Emulator Suite đã được SL-002/003 chuẩn bị; thiếu environment là blocker/failure, không skipped PASS.

App focused tests sau khi SL-001 cấu hình runner: `pnpm test --runTestsByPath __tests__/solo-history.test.ts`. Backend focused tests sau backend bootstrap SL-003 và native/emulator prerequisites SL-002: `node --test functions/tests/solo-history.test.cjs`. TypeScript: `pnpm exec tsc --noEmit`. Lint: `pnpm run lint` chỉ khi repository có ESLint setup thực tế.

Lệnh app chạy từ `dontlift-mobile/`; file paths tests/backend ở trên là planned targets. Command chỉ được chạy sau harness/dependency prerequisites. Native build/emulator commands phải lấy từ cấu hình thật sau SL-002; không đoán project ID, runtime hoặc production alias. Future schema/index changes được test với approved edition Standard.

Ghi trong kết quả execution: baseline/commit mới, command, exit status, số cases, emulator/device/runtime version, date, actual outcomes và remaining gaps. Các checklist hiện đều chưa chạy.

## 8. Human review và bàn giao P6.2

Human phải duyệt scope, non-goals, tasks, acceptance cases, dependencies và các quyết định còn mở của **SL-012** trước implementation. Duyệt một slice không duyệt tất cả 37; duyệt authoring batch không duyệt code.

Sau approval, cập nhật trạng thái/date/decision evidence trong đúng plan; kế hoạch mới chỉ đủ execution-ready khi blocker đã được giải quyết và baseline được re-inspect. Dùng qskill-executing-plans khi user yêu cầu execute plan đã duyệt. Không tự bắt đầu P6.2 từ file draft hoặc từ prompt batch.
