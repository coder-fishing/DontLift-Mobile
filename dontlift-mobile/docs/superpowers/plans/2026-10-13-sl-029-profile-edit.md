# Kế hoạch triển khai P6.1 — SL-029: Xem và sửa profile

> **For agentic workers:** REQUIRED SUB-SKILL: Use the qskill-executing-plans skill to implement this plan task-by-task. Steps use checkbox tracking.
> Kế hoạch chỉ mô tả file, unit, hành vi, quy tắc, đầu ra và test cases; không có implementation code hoặc signatures. Đọc source thật trước mỗi task.
> **Gate:** Không execute kế hoạch khi trạng thái còn DRAFT hoặc khi blocker/dependency chưa giải quyết. Việc tạo file này không phê duyệt backlog hay P6.2.

**Mục tiêu:** Xem và sửa profile: Validated allowlisted name update, realtime UI/local projection.

**Slice:** SL-029. **Ưu tiên đề xuất:** P1. **Release:** MVP + activation/Premium; post-MVP deferred. SL-036 chỉ được tính release sau D6.

**Trạng thái kế hoạch:** APPROVED — human duyệt phạm vi và online-only save ngày 2026-10-23.
**Trạng thái implementation quan sát (2026-10-23):** Đã thêm repository/UI/navigation và Rules allowlist; unit, typecheck và profile Rules Emulator tests đã chạy qua. Cần kiểm tra trực tiếp trên Expo Go để nghiệm thu UI và thao tác online/offline.
**Baseline khảo sát:** docs/p6.0-implementation-slices tại 57ca1eb28a2952c66d01f89b9b89bf755ab4812a.
**Ngày soạn:** 2026-10-13, Asia/Saigon.
**Plan slug:** `2026-10-13-sl-029-profile-edit`; mọi commit thực hiện plan này phải bắt đầu `[2026-10-13-sl-029-profile-edit]`.
**Đầu vào phạm vi:** Backlog P6.0 v0.1 trong cuộc trò chuyện ngày 2026-10-13, chưa được phê duyệt. User đã yêu cầu ghi draft P6.1 cho cả 37 slice; không suy thành approval thực thi.
**Traceability:** US-17; ADR-004; ARCH §5–6.
**Phụ thuộc bắt buộc:** [SL-004](./2026-10-13-sl-004-login-session.md)
**Ưu tiên mềm:** Theo thứ tự đề xuất trong [mục lục](../../implementation-plan.md); thứ tự không tạo thêm hard dependency.

## 1. Nguồn và ranh giới

Đọc [PRD](../../product-requirements.md), [Feature Spec](../../feature-specification.md), [Product Design](../../product-design.md), [Design Brief](../../product-design-brief.md), [Architecture](../../software-architecture.md), [API contracts](../../api-contracts.md), ADR áp dụng trong [decisions](../../decisions), cùng AGENTS ở app root. Tham chiếu cụ thể của slice nằm trong Traceability phía trên.

V01–V10 chỉ các màn tương ứng tại `design/concepts/concept-final/screens/`; prototype nằm tại `prototype/`. Chúng là read-only visual/interaction references, không chứng minh integration. Nếu journey không có design screen, trình bày gap với human trước quyết định UI mới.

**Kiến trúc:** profile editing controller sở hữu hành vi của slice. Presentation đọc kết quả qua controller/repository; không tự trở thành nguồn authoritative. Units và đường dẫn mới bên dưới là đề xuất, chưa tồn tại trên baseline; nếu prerequisite đã tạo cùng trách nhiệm thì reuse, không thêm convention thứ hai.

**Stack:** Expo SDK 57 / React Native / TypeScript. SQLite cho local-first khi slice có persistence; React Native Firebase Auth/Firestore Standard/Functions cho boundary có Firebase. Không bắt slice thuần local phải có network.

**Không gồm:** Email changes, account deletion, generic sync-event cho profile chưa accepted.

## 2. Blocker, risk và quyết định cần duyệt

- Không có blocker riêng được xác nhận trong draft; dependency và quyền/runtime vẫn phải đạt gate trước thực thi.

**Quyết định đã duyệt (2026-10-23):** Edit `displayName` dài 1–40 Unicode code points sau khi trim. Firestore `users/{uid}` là nguồn chuẩn; `email` và `isPremium` chỉ đọc. Khi offline, giữ input, báo chưa lưu và cho thử lại khi có mạng; không queue write. Mọi cập nhật phải owner-only và chỉ đổi `displayName` cùng server `updatedAt`. Account tab mở ProfileScreen.

**Rủi ro cụ thể:** Offline-edit behavior và Auth/Firestore name consistency cần review.

Nếu một contract chỉ có responsibility mà chưa có schema, task đầu là trình bày missing decision với nguồn; không tự tạo endpoint/field mới. Các hành vi test bên dưới mô tả outcome cần đạt, không thay thế wire approval. Ngưỡng/range/default chưa được spec xác định phải có quyết định ghi lại trước khi implement.

## 3. File và quyền sở hữu dự kiến

Các đường dẫn sau tương đối với `dontlift-mobile/`. Đọc lại trạng thái file lúc execute để chọn Create/Modify; không ghi đè implementation của dependency.

| File dự kiến | Trách nhiệm |
|---|---|
| `functions/tests/profile-rules.emulator.test.cjs` | Owner profile reads/allowlisted edits, cross-user deny và entitlement immutability bằng client SDK trên emulator. |
| `src/features/profile/profile-repository.ts` | Unit/repository/adapter chuyên trách; reuse nếu prerequisite đã tạo. |
| `src/features/profile/profile-controller.ts` | Unit/repository/adapter chuyên trách; reuse nếu prerequisite đã tạo. |
| `src/screens/ProfileScreen.tsx` | Presentation và states của journey; không chứa domain math/sync authority. |
| `src/app/index.tsx` | Đăng ký state/route của ProfileScreen và render màn hình trong app flow hiện tại. |
| `src/types.ts` | Bổ sung định danh màn Profile vào ScreenId dùng chung. |
| `src/constants.ts` | Bổ sung tiêu đề màn Profile theo ScreenId. |
| `src/components/BottomNav.tsx` | Điều hướng tab Account tới Profile thay vì Login. |
| `firestore.rules` | Rules đang được `firebase.json` và `firebase.emulator.json` sử dụng; SL-029 thêm profile owner update allowlist trực tiếp vào nguồn đang cấu hình. Không deploy Cloud trong slice này. |
| `src/features/auth/auth-session.tsx` | Unit/repository/adapter chuyên trách; reuse nếu prerequisite đã tạo. |
| `__tests__/profile-edit.test.ts` | Kiểm thử dự kiến; chưa tạo test source trong P6.1. |
| `functions/tests/profile-edit.test.cjs` | Kiểm thử dự kiến; chưa tạo test source trong P6.1. |

**Unit:** profile editing controller.
**Nhận:** Current user canonical profile và proposed display name.
**Trả:** Validated allowlisted name update, realtime UI/local projection.
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

### Ownership Rules profile

SL-029 không là nền tảng Rules cho lobby. Dùng local Rules/config từ SL-002, harness SL-003 và các resource Rules đã có trên baseline lúc execution; chỉ thêm profile owner read/displayName allowlisted edit. Giữ room/member và history Rules, không replace file bằng policy chỉ cho profile.

- [x] Owner đọc profile/sửa displayName được; user khác/anonymous bị deny (Firestore Emulator client assertions).
- [x] Create/update parity và field allowlist chặn client tự sửa isPremium/email/server timestamps.
- [x] Chạy profile Rules client tests cùng resource regression trong Emulator Suite; Admin fixtures không thay client assertions.
- [x] Xác nhận emulator và firebase.json cùng đọc canonical `firestore.rules`; chưa deploy lên Firebase Cloud.

### Task 1 — Boundary và quy tắc của Xem và sửa profile

**Files:** Dùng units/config/backend/repositories trong bảng mục 3; khi test source đã được chỉ định, đặt cases thuộc boundary vào đúng app/backend target. Không thay presentation chưa cần cho task này.

**Nhận/trả:** Nhận Current user canonical profile và proposed display name; trả Validated allowlisted name update, realtime UI/local projection. Với contract đang bị chặn, chưa có quyền thêm schema dù test outcome đã được nêu.

- [ ] Đọc lại source/spec và xác nhận tất cả blocker cùng dependency cho task đã được giải quyết; nếu chưa, dừng execution và báo đúng blocker.
- [ ] Viết focused failing cases sau đây; runner không tìm thấy hoặc thiếu dependency không được tính là red nghiệp vụ.

- [x] Name hợp lệ → displayName thay đổi (repository unit test).
- [x] Chọn tab Account → mở ProfileScreen; màn profile có đường quay lại luồng chính (navigation wired; device verification pending).
- [x] Tên rỗng/quá limit đã duyệt → field error (1–40 Unicode code points).
- [x] Client đổi isPremium/email → deny (Firestore Emulator).

- [ ] Chạy focused command trong mục 7; xác nhận failure đúng behavior đang thiếu, không từ toolchain lỗi.
- [ ] Xây hành vi theo thứ tự sau, chỉ sau approval:

1. Đọc current-user profile; displayName là editable field, email/entitlement immutable từ client.
2. Validate theo name rule được human tiếp nhận; update allowlist và Rules create/update parity.
3. Canonical Firestore name là authority; không để Auth stale name/bootstrap overwrite edit.

- [x] Chạy lại các cases và đối chiếu output/invariants; unit mock không được tính là native/integration pass.
- [ ] Review task và commit chỉ files thuộc task nếu execution được phép. Subject dùng `[2026-10-13-sl-029-profile-edit]`, trailer `Plan: docs/superpowers/plans/2026-10-13-sl-029-profile-edit.md` và `Task: 1`.

### Task 2 — Journey tích hợp và recovery

**Files:** Presentation/adapter/evidence trong mục 3 cùng boundary task 1; không refactor screen không liên quan. Task này không tạo implementation thứ hai cho unit task 1.

**Nhận:** Output task 1 đã kiểm chứng. **Trả:** Journey/bằng chứng có thể nghiệm thu; error/offline không false-success.

- [ ] Viết các failing cases về integration/recovery sau; không viết tests chỉ mirror implementation.

- [x] User B sửa profile A → deny (Firestore Emulator).
- [x] Restore sau edit → không khôi phục tên Auth cũ (Firestore listener updates session; device verification pending).
- [x] Write fail → input còn, không false success (component giữ state nhập khi lỗi; device verification pending).

- [x] Chạy focused unit và Rules Emulator checks; giữ fixtures tách khỏi device evidence.
- [ ] Tích hợp theo thứ tự:

1. Form loading/save/error/retry giữ input; successful snapshot cập nhật UI ngay.
2. Local projection cập nhật từ canonical state; failure không báo saved giả.
3. Offline edit acceptance cần chốt trước chọn queue/offline behavior; không thêm outbox event type tự động.
4. [x] Đăng ký ProfileScreen vào app navigation hiện có, thêm ScreenId/title và nối tab Account tới màn profile; không để người dùng phải vào route prototype/debug để truy cập.

- [ ] Thực hiện các kịch bản nghiệm thu trực tiếp trong mục 6; thu logs an toàn/device timestamps khi cần.
- [ ] Review kết quả; một branch fail hoặc thiếu required device/emulator evidence thì slice chưa hoàn thành.
- [ ] Commit task sau review nếu execution được phép. Subject dùng `[2026-10-13-sl-029-profile-edit]`, trailer `Plan: docs/superpowers/plans/2026-10-13-sl-029-profile-edit.md` và `Task: 2`.

## 6. Nghiệm thu và failure outcomes

- [ ] Name hợp lệ → displayName thay đổi.
- [ ] Tên rỗng/quá limit đã duyệt → field error.
- [ ] Client đổi isPremium/email → deny.
- [ ] User B sửa profile A → deny.
- [ ] Restore sau edit → không khôi phục tên Auth cũ.
- [ ] Write fail → input còn, không false success.
- [ ] Hai authorized views nhận name snapshot → local projection theo cùng canonical data.
- [ ] Offline theo policy được duyệt → cached/unsaved rõ, không authoritative success giả.

Mỗi case phải có actual result. Unit cases dùng controlled fixtures để chứng minh domain; Firebase boundary cần Rules/Functions emulator tests cho allowed/denied/replay/concurrency khi áp dụng. Sensor/lifecycle cần physical devices. Không có evidence thì ghi UNVERIFIED và blocker, không tick PASS.

**Failure recovery bắt buộc:** không hiển thị successful save/transition khi commit/request chưa thành công; giữ dữ liệu/retry context theo hành vi cụ thể trong tasks. Không log email đầy đủ, token, activation code hoặc bank details. Case không áp dụng cho slice phải ghi lý do trong evidence, không bỏ im lặng.

## 7. Verification và ghi nhận evidence

Rules focused command: `node --test functions/tests/profile-rules.emulator.test.cjs` trong local Emulator Suite đã cấu hình. Không claim policy an toàn chỉ từ controller mocks hoặc Admin SDK checks.

App focused tests sau khi SL-001 cấu hình runner: `pnpm test --runTestsByPath __tests__/profile-edit.test.ts`. Backend focused tests sau backend bootstrap SL-003 và native/emulator prerequisites SL-002: `node --test functions/tests/profile-edit.test.cjs`. TypeScript: `pnpm exec tsc --noEmit`. Lint: `pnpm run lint` chỉ khi repository có ESLint setup thực tế.

Lệnh app chạy từ `dontlift-mobile/`; file paths tests/backend ở trên là planned targets. Command chỉ được chạy sau harness/dependency prerequisites. Native build/emulator commands phải lấy từ cấu hình thật sau SL-002; không đoán project ID, runtime hoặc production alias. Future schema/index changes được test với approved edition Standard.

**Evidence 2026-10-23:** `pnpm exec tsc --noEmit` PASS; `pnpm exec jest --runInBand --runTestsByPath __tests__/profile-edit.test.ts` PASS (5 tests); Firebase Firestore Emulator (Standard, demo project, Java 25 / Node 24) `pnpm run test:rules` PASS (6 tests, gồm 40/41 emoji). ESLint chưa chạy được: `expo lint` tự tạo config tương tác rồi không trả output, đã dừng và xóa config phát sinh. Expo Go visual/online/offline checks còn cần chạy thủ công. Không có Firebase Cloud deploy.

## 8. Human review và bàn giao P6.2

Human đã duyệt scope, non-goals, tasks và quyết định offline ở trên ngày 2026-10-23. Duyệt một slice không duyệt tất cả 37; duyệt authoring batch không duyệt code.

Sau approval, cập nhật trạng thái/date/decision evidence trong đúng plan; kế hoạch mới chỉ đủ execution-ready khi blocker đã được giải quyết và baseline được re-inspect. Dùng qskill-executing-plans khi user yêu cầu execute plan đã duyệt. Không tự bắt đầu P6.2 từ file draft hoặc từ prompt batch.
