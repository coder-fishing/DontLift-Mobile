# Kế hoạch triển khai P6.1 — SL-015: Member join bằng QR

> **For agentic workers:** REQUIRED SUB-SKILL: Use the qskill-executing-plans skill to implement this plan task-by-task. Steps use checkbox tracking.
> Kế hoạch chỉ mô tả file, unit, hành vi, quy tắc, đầu ra và test cases; không có implementation code hoặc signatures. Đọc source thật trước mỗi task.
> **Gate:** Execution được human duyệt riêng cho SL-015 ngày 2026-10-20; kiểm chứng camera trên thiết bị thật vẫn là evidence cần bổ sung.

**Mục tiêu:** Member join bằng QR: Validated PIN được chuyển vào join boundary SL-014 hoặc safe invalid invitation.

**Slice:** SL-015. **Ưu tiên đề xuất:** P1. **Release:** MVP + activation/Premium; post-MVP deferred. SL-036 chỉ được tính release sau D6.

**Trạng thái kế hoạch:** APPROVED FOR EXECUTION — human duyệt scope, tasks và acceptance ngày 2026-10-20; D13 đã giải quyết.
**Trạng thái implementation quan sát:** Đang triển khai trên `feature/sl-015-join-room-by-qr`; chưa có device evidence.
**Baseline khảo sát:** `main` tại `441e225` (sau khi merge SL-014).
**Ngày soạn:** 2026-10-13, Asia/Saigon.
**Plan slug:** `2026-10-13-sl-015-room-join-qr`; mọi commit thực hiện plan này phải bắt đầu `[2026-10-13-sl-015-room-join-qr]`.
**Đầu vào phạm vi:** Backlog P6.0 v0.1 trong cuộc trò chuyện ngày 2026-10-13, chưa được phê duyệt. User đã yêu cầu ghi draft P6.1 cho cả 37 slice; không suy thành approval thực thi.
**Traceability:** US-07; FS §4.2; V05.
**Phụ thuộc bắt buộc:** [SL-014](./2026-10-13-sl-014-room-join-pin.md)
**Ưu tiên mềm:** Theo thứ tự đề xuất trong [mục lục](../../implementation-plan.md); thứ tự không tạo thêm hard dependency.

## 1. Nguồn và ranh giới

Đọc [PRD](../../product-requirements.md), [Feature Spec](../../feature-specification.md), [Product Design](../../product-design.md), [Design Brief](../../product-design-brief.md), [Architecture](../../software-architecture.md), [API contracts](../../api-contracts.md), ADR áp dụng trong [decisions](../../decisions), cùng AGENTS ở app root. Tham chiếu cụ thể của slice nằm trong Traceability phía trên.

V01–V10 chỉ các màn tương ứng tại `design/concepts/concept-final/screens/`; prototype nằm tại `prototype/`. Chúng là read-only visual/interaction references, không chứng minh integration. Nếu journey không có design screen, trình bày gap với human trước quyết định UI mới.

**Kiến trúc:** room invitation parser sở hữu hành vi của slice. Presentation đọc kết quả qua controller/repository; không tự trở thành nguồn authoritative. Units và đường dẫn mới bên dưới là đề xuất, chưa tồn tại trên baseline; nếu prerequisite đã tạo cùng trách nhiệm thì reuse, không thêm convention thứ hai.

**Stack:** Expo SDK 57 / React Native / TypeScript. SQLite cho local-first khi slice có persistence; React Native Firebase Auth/Firestore Standard/Functions cho boundary có Firebase. Không bắt slice thuần local phải có network.

**Không gồm:** Camera detection, social sharing platform integration chưa có scope.

Trong slice này, camera chỉ được dùng để quét QR invitation có consent; camera-based phone detection vẫn ngoài phạm vi.

## 2. Blocker, risk và quyết định cần duyệt

- **E1 — DEVICE EVIDENCE PENDING:** `expo-camera ~57.0.6` được Expo SDK 57 hỗ trợ trong Expo Go; slice không cần Development Build riêng. Cần thiết bị Android/iOS thật để xác minh permission và camera, chưa có evidence cho đến khi chạy trên thiết bị.
- **D13 — RESOLVED 2026-10-20:** Reuse canonical invitation do SL-013 sở hữu: `dontliftmobile://room/{PIN}`; PIN mới tám chữ số và legacy bốn chữ số.

**Rủi ro cụ thể:** Scheme dontliftmobile hiện khác dontlift example; cần duyệt một canonical format.

Nếu một contract chỉ có responsibility mà chưa có schema, task đầu là trình bày missing decision với nguồn; không tự tạo endpoint/field mới. Các hành vi test bên dưới mô tả outcome cần đạt, không thay thế wire approval. Ngưỡng/range/default chưa được spec xác định phải có quyết định ghi lại trước khi implement.

## 3. File và quyền sở hữu dự kiến

Các đường dẫn sau tương đối với `dontlift-mobile/`. Đọc lại trạng thái file lúc execute để chọn Create/Modify; không ghi đè implementation của dependency.

| File dự kiến | Trách nhiệm |
|---|---|
| `src/features/rooms/room-invite-parser.ts` | Unit/repository/adapter chuyên trách; reuse nếu prerequisite đã tạo. |
| `src/features/rooms/room-invite-contract.ts` | Reuse contract/encoder SL-013; parser không ghi đè hoặc tạo format khác. |
| `src/screens/JoinRoomScreen.tsx` | Presentation và states của journey; không chứa domain math/sync authority. |
| `package.json` | SL-015 sở hữu việc chọn và khai báo package quét QR tương thích Expo SDK đang dùng sau khi xác minh native support. |
| `package-lock.json`, `pnpm-lock.yaml` | SL-015 sở hữu cập nhật đồng bộ cả hai lockfile khi thêm package scanner theo quy tắc repo. |
| `app.json` | SL-015 sở hữu cấu hình plugin và quyền camera tối thiểu theo package đã chọn; đọc cấu hình thực tế trước khi sửa. |
| `__tests__/room-join-qr.test.ts` | Kiểm thử dự kiến; chưa tạo test source trong P6.1. |

**Unit:** room invitation parser.
**Nhận:** Scanned QR có đúng scheme đã duyệt.
**Trả:** Validated PIN được chuyển vào join boundary SL-014 hoặc safe invalid invitation.
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

### Task 1 — Boundary và quy tắc của Member join bằng QR

**Files:** Dùng units/config/backend/repositories trong bảng mục 3; khi test source đã được chỉ định, đặt cases thuộc boundary vào đúng app/backend target. Không thay presentation chưa cần cho task này.

**Nhận/trả:** Nhận Scanned QR hoặc app deep link đúng scheme đã duyệt; trả Validated PIN được chuyển vào join boundary SL-014 hoặc safe invalid invitation. Với contract đang bị chặn, chưa có quyền thêm schema dù test outcome đã được nêu.

- [x] Đọc lại source/spec, xác nhận SL-014 đã merge vào main và D13 đã được giải quyết; E1 còn yêu cầu evidence thiết bị thật.
- [x] Viết focused failing cases sau đây; runner không tìm thấy hoặc thiếu dependency không được tính là red nghiệp vụ.

- [x] Invitation QR hợp lệ → resolve PIN và join boundary.
- [x] QR banking hoặc link không đúng scheme → invalid invitation.
- [x] PIN length không đúng → reject trước network.

- [x] Chạy focused command trong mục 7; test ban đầu fail vì parser chưa tồn tại.
- [x] Xây hành vi theo thứ tự sau:

1. Kiểm tra D13 và reuse canonical payload/app scheme cùng encoder SL-013; chỉ decode PIN rồi đi qua join boundary SL-014, QR không chứng minh membership hoặc bypass capacity.
2. Xác minh package camera/QR tương thích Expo SDK và native targets hiện tại; sau đó SL-015 thêm dependency cùng cập nhật cả hai lockfile.
3. Cấu hình quyền camera và plugin native theo yêu cầu package đã chọn; chỉ xin quyền khi người dùng mở scanner.
4. Chỉ chấp nhận room invitation shape được duyệt; QR banking/unknown link không join.
5. Reuse join PIN command; không tạo endpoint thứ hai hoặc client-side capacity rule.

- [x] Chạy lại parser cases và đối chiếu output/invariants; không tuyên bố native/integration PASS từ mock.
- [ ] Review/commit task: commit được hoãn theo yêu cầu của human; chưa tạo commit.

### Task 2 — Journey tích hợp và recovery

**Files:** Presentation/adapter/evidence trong mục 3 cùng boundary task 1; không refactor screen không liên quan. Task này không tạo implementation thứ hai cho unit task 1.

**Nhận:** Output task 1 đã kiểm chứng. **Trả:** Journey/bằng chứng có thể nghiệm thu; error/offline không false-success.

- [x] Viết các failing cases về integration/recovery sau; test ban đầu fail vì scanner chưa có.

- [x] Permission denied → scanner không chạy, có recovery.
- [x] Package scanner và cấu hình native tương thích Android/iOS; cả hai lockfile phản ánh cùng dependency.
- [x] Repeated frame cùng QR → một lần gọi join; scanner đóng ngay sau frame đầu.
- [x] Offline join reuse SL-014 boundary không queue membership mutation.

- [x] Chạy focused checks; giữ fixtures tách khỏi device evidence.
- [x] Tích hợp theo thứ tự:

1. Permission camera denied có recovery; scanner chỉ active trên màn join.
2. Repeated scans khi request đang chạy không gửi duplicate; result vẫn đi qua idempotent backend.
3. QR invalid không expose raw sensitive text; offline giữ thông báo network cần thiết.

- [ ] Thực hiện các kịch bản nghiệm thu trực tiếp trên Expo Go/thiết bị thật; hiện chưa có device evidence.
- [ ] Review kết quả native; slice chưa được tuyên bố hoàn tất khi thiếu camera evidence trên thiết bị.
- [ ] Commit task được hoãn theo yêu cầu của human. Nếu được yêu cầu sau, subject dùng `[2026-10-13-sl-015-room-join-qr]`, trailer `Plan: docs/superpowers/plans/2026-10-13-sl-015-room-join-qr.md` và `Task: 2`.

## 6. Nghiệm thu và failure outcomes

- [x] Invitation QR hợp lệ → resolve PIN và gọi join boundary; screen test xác nhận một lần gọi.
- [x] QR banking hoặc link không đúng scheme → invalid invitation, không hiển thị raw QR content.
- [x] PIN length không đúng → parser loại trước khi gọi join boundary.
- [x] Permission denied → scanner không chạy, có hướng dẫn nhập PIN và mở Settings khi cần.
- [x] Repeated frame cùng QR → một lần gọi join trong lúc scanner đóng.
- [x] Offline join reuse SL-014 command, không queue membership mutation; covered by `room-join-pin.test.ts`.
- [ ] Hai thiết bị share/scan invitation thật → UNVERIFIED, cần Expo Go trên device.
- [ ] Round-trip payload thật từ Host lobby SL-013 trên thiết bị thứ hai → UNVERIFIED, cần thiết bị thứ hai.
- [x] QR scanner chỉ dùng barcode QR và join PIN; không thêm camera-based phone detection.

Mỗi case phải có actual result. Unit cases dùng controlled fixtures để chứng minh domain; Firebase boundary cần Rules/Functions emulator tests cho allowed/denied/replay/concurrency khi áp dụng. Sensor/lifecycle cần physical devices. Không có evidence thì ghi UNVERIFIED và blocker, không tick PASS.

**Failure recovery bắt buộc:** không hiển thị successful save/transition khi commit/request chưa thành công; giữ dữ liệu/retry context theo hành vi cụ thể trong tasks. Không log email đầy đủ, token, activation code hoặc bank details. Case không áp dụng cho slice phải ghi lý do trong evidence, không bỏ im lặng.

## 7. Verification và ghi nhận evidence

App focused tests: `pnpm exec jest --runInBand __tests__/room-join-qr.test.ts __tests__/room-join-qr-screen.test.tsx`. Full unit suite: `pnpm exec jest --runInBand`. TypeScript: `pnpm exec tsc --noEmit`. Lint: `pnpm run lint` chỉ khi repository có ESLint setup thực tế.

Lệnh app chạy từ `dontlift-mobile/`; file paths tests/backend ở trên là planned targets. Command chỉ được chạy sau harness/dependency prerequisites. Native build/emulator commands phải lấy từ cấu hình thật sau SL-002; không đoán project ID, runtime hoặc production alias. Future schema/index changes được test với approved edition Standard.

**Evidence 2026-10-20:** Baseline `main` `441e225`; implementation branch `feature/sl-015-join-room-by-qr`. `pnpm exec jest --runInBand` — PASS, 23 suites / 169 tests; parser + screen focused tests — PASS, 12 cases; `pnpm exec tsc --noEmit` — PASS; `pnpm exec expo config --type public --json` — PASS; `git diff --check` — PASS. Không có ESLint config nên lint không chạy. Expo Go camera/permission flow và QR round-trip hai thiết bị — UNVERIFIED, cần human chạy trên device. Không thay Firestore, Rules, Functions; không bật billing/deploy. Không commit/push theo yêu cầu hiện tại.

## 8. Human review và bàn giao P6.2

Human đã duyệt scope, non-goals, tasks và acceptance cases của **SL-015** ngày 2026-10-20. External OS deep-link routing không nằm trong scope QR scanner này; parser chỉ xác nhận payload của QR rồi chuyển PIN qua SL-014. Duyệt một slice không duyệt tất cả 37.

Sau approval, cập nhật trạng thái/date/decision evidence trong đúng plan; kiểm chứng physical device còn pending. Dùng qskill-executing-plans khi user yêu cầu execute plan đã duyệt. Không tự bắt đầu P6.2 từ file draft hoặc từ prompt batch.
