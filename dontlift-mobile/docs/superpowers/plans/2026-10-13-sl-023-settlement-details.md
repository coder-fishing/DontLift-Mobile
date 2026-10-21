# Kế hoạch triển khai P6.1 — SL-023: Host nhập thông tin nhận tiền

> **For agentic workers:** REQUIRED SUB-SKILL: Use the qskill-executing-plans skill to implement this plan task-by-task. Steps use checkbox tracking.
> Kế hoạch chỉ mô tả file, unit, hành vi, quy tắc, đầu ra và test cases; không có implementation code hoặc signatures. Đọc source thật trước mỗi task.
> **Gate:** Đã được human duyệt triển khai trên Firebase Spark ngày 2026-10-21 theo ADR-020. Việc duyệt này chỉ áp dụng SL-023, không phê duyệt backlog hay P6.2.

**Mục tiêu:** Host nhập thông tin nhận tiền: Room-scoped details có `expiresAt` sau `endedAt` 30 ngày.

**Slice:** SL-023. **Ưu tiên đề xuất:** P1. **Release:** MVP + activation/Premium; post-MVP deferred. SL-036 chỉ được tính release sau D6.

**Trạng thái kế hoạch:** APPROVED FOR EXECUTION — Spark client transaction/Rules; không Functions, billing hoặc scheduled cleanup.
**Trạng thái implementation:** Code đã được triển khai; TypeScript PASS. Rules Emulator Suite chưa chạy do thiếu Java; Expo Go và Cloud Rules chưa được kiểm tra/deploy trong lượt này.
**Baseline khảo sát:** docs/p6.0-implementation-slices tại 57ca1eb28a2952c66d01f89b9b89bf755ab4812a.
**Ngày soạn:** 2026-10-13, Asia/Saigon.
**Plan slug:** `2026-10-13-sl-023-settlement-details`; mọi commit thực hiện plan này phải bắt đầu `[2026-10-13-sl-023-settlement-details]`.
**Đầu vào phạm vi:** SL-023 được human duyệt riêng ngày 2026-10-21 với ngoại lệ Spark ở ADR-020; approval không áp dụng các slice khác.
**Traceability:** US-15; API §6.1; ADR-005; ADR-020; V08.
**Phụ thuộc bắt buộc:** [SL-020](./2026-10-13-sl-020-room-completion.md)
**Ưu tiên mềm:** Theo thứ tự đề xuất trong [mục lục](../../implementation-plan.md); thứ tự không tạo thêm hard dependency.

## 1. Nguồn và ranh giới

Đọc [PRD](../../product-requirements.md), [Feature Spec](../../feature-specification.md), [Product Design](../../product-design.md), [Design Brief](../../product-design-brief.md), [Architecture](../../software-architecture.md), [API contracts](../../api-contracts.md), ADR áp dụng trong [decisions](../../decisions), cùng AGENTS ở app root. Tham chiếu cụ thể của slice nằm trong Traceability phía trên.

V01–V10 chỉ các màn tương ứng tại `design/concepts/concept-final/screens/`; prototype nằm tại `prototype/`. Chúng là read-only visual/interaction references, không chứng minh integration. Nếu journey không có design screen, trình bày gap với human trước quyết định UI mới.

**Kiến trúc:** setSettlementDetails sở hữu hành vi của slice. Presentation đọc kết quả qua controller/repository; không tự trở thành nguồn authoritative. Units và đường dẫn mới bên dưới là đề xuất, chưa tồn tại trên baseline; nếu prerequisite đã tạo cùng trách nhiệm thì reuse, không thêm convention thứ hai.

**Stack:** Expo SDK 57 / React Native / TypeScript / Firebase JS SDK. SL-023 uses authenticated Firestore client transactions and Rules on Firebase Spark; no Cloud Functions, billing upgrade, scheduler, or local bank-detail persistence.

**Danh mục ngân hàng:** form Host có thể tải danh sách ngân hàng công khai của VietQR, bao gồm BIN, để lưu BIN cùng settlement details. Dữ liệu này là nền cho bước tạo VietQR sau; không tra cứu chủ tài khoản hoặc gọi API có credential trong slice này.

**Không gồm:** Money transfer, globally reusable bank account book, automatic bank validation.

## 2. Quyết định đã duyệt và giới hạn

- Firebase Spark được duyệt ngày 2026-10-21: Host ghi bằng Firestore transaction + Rules sau khi room COMPLETED/FINALIZED; thành viên đọc trước expiry; không receipt riêng; retry upsert cùng path/dữ liệu.
- `expiresAt = room.endedAt + 30 ngày`; Rules chặn đọc sau expiry. Slice này không xóa vật lý; cleanup/retention được deferred tới SL-033.
- Field bounds: `bankId` 1–32, `accountNumber` 1–64, `accountName` 1–100 ký tự sau trim. Chọn ngân hàng từ danh mục công khai sẽ lưu BIN vào `bankId`; không tra cứu chủ tài khoản trong slice này.

**Rủi ro cụ thể:** Rules phải cho phép member đọc một document chưa tồn tại để hiển thị trạng thái chưa nhập; Emulator Suite xác nhận hành vi get thiếu document. Hết hạn chỉ bị ẩn đến khi SL-033 xác định purge phù hợp với Spark.

Nếu một contract chỉ có responsibility mà chưa có schema, task đầu là trình bày missing decision với nguồn; không tự tạo endpoint/field mới. Các hành vi test bên dưới mô tả outcome cần đạt, không thay thế wire approval. Ngưỡng/range/default chưa được spec xác định phải có quyết định ghi lại trước khi implement.

## 3. File và quyền sở hữu dự kiến

Các đường dẫn sau tương đối với `dontlift-mobile/`. Đọc lại trạng thái file lúc execute để chọn Create/Modify; không ghi đè implementation của dependency.

| File dự kiến | Trách nhiệm |
|---|---|
| `firestore.rules` | Host-only create/update sau COMPLETED/FINALIZED; member get trước expiry; deny list/delete/outsider. |
| `functions/tests/settlement-details-rules.emulator.test.cjs` | Client-SDK Emulator Suite tests cho member allowed read, anonymous/outsider/cross-room denial và client write denial. |
| `src/features/settlement/settlement-details-repository.ts` | Spark transaction, server-confirmed read và field validation; không lưu SQLite. |
| `src/screens/SettlementDetailsScreen.tsx` | Presentation và states của journey; không chứa domain math/sync authority. |
| `src/app/index.tsx` | Đăng ký render state/route cho SettlementDetailsScreen theo điều hướng hiện có. |
| `src/types.ts` | Thêm ScreenId cho SettlementDetails. |
| `src/constants.ts` | Thêm screen title vào map hiện có. |
| `src/screens/GroupSummaryScreen.tsx` | Thêm Host entry sau khi kết quả room được finalized/reconciled; không cho Member submit. |
| `docs/decisions/ADR-020-spark-settlement-details.md` | Ghi lại ngoại lệ Spark được duyệt và giới hạn retention. |
| `__tests__/settlement-details.test.ts` | Kiểm thử dự kiến; chưa tạo test source trong P6.1. |
| `__tests__/settlement-details-navigation.test.ts` | Kiểm thử GroupSummary-to-details route, Host-only entry và tiếp tục sang bill allocation sau lưu thành công. |
| `functions/tests/settlement-details.test.cjs` | Kiểm thử dự kiến; chưa tạo test source trong P6.1. |

**Unit:** setSettlementDetails.
**Nhận:** Host, COMPLETED/FINALIZED room, bankId/accountNumber/accountName.
**Trả:** Room-scoped details có expiresAt từ `endedAt` + 30 ngày.
**Đầu vào từ dependency:** capabilities/records/commands đã nghiệm thu theo các plan liên kết; chưa có dependency output thì không giả coi integration có thật.
**Đầu ra cho slice sau:** outcome và invariants trong mục tiêu/nghiệm thu dưới đây; tên internal unit là đề xuất, wire names chỉ dùng theo API/ADR đã duyệt.

### Contract SL-023 đã được duyệt

Bảng dưới là contract đã duyệt cho ngoại lệ Spark này; nó không dùng common callable request/receipt envelope.

| Field | Bắt buộc / hướng | Quy tắc |
|---|---|---|
| version | Response | 1. |
| requestId | Không dùng trong ngoại lệ Spark đã duyệt | Không có command receipt riêng; retry upsert cùng path. |
| roomId | Bắt buộc | UUID completed room. |
| bankId | Bắt buộc | 1–32 ký tự sau trim; không xác minh ngân hàng. |
| accountNumber | Bắt buộc | 1–64 ký tự sau trim; không log hoặc lưu local. |
| accountName | Bắt buộc | 1–100 ký tự sau trim. |
| updatedAt | Ghi | Firestore `request.time`. |
| expiresAt | Ghi/đọc | `room.endedAt + 30 ngày`, Rules chặn đọc khi đã hết hạn. |

## 4. Ràng buộc xuyên suốt

- Giữ approved architecture; newer human decisions và accepted ADR exceptions thắng prose cũ.
- Không sao chép Firebase token vào SQLite, AsyncStorage hoặc SecureStore; SDK quản lý session.
- Event offline-capable dùng SQLite domain record và sync_outbox trong một transaction; syncEvents là ingestion authority.
- Command lifecycle/vote/bill/payment không queue để replay muộn. Firestore cache không thay thế outbox.
- Membership authority là rooms/{roomId}/members/{uid}. Spark transaction derives actor từ Firebase Auth; Firestore Rules xác nhận lifecycle, role, schema và server timestamps.
- Giữ 3-Second Grace Period ở cả foreground/background theo ADR-008.
- Local Premium không cấp server quota/capacity; chỉ verified Server Premium cấp server benefits.
- Bill dùng integer VND, deterministic residual và tổng exact theo ADR-005; VietQR non-custodial, không bank polling.
- UI dùng semantic tokens và accepted Liquid Acrylic; loading/empty/error/offline/syncing, labels, safe areas và touch targets được kiểm chứng khi phù hợp.
- Không thêm social login, analytics dashboards, kiosk, wallet, chat, AI coaching hoặc camera-based detection vào MVP.
- Không deploy Rules hoặc publish trong lượt này; Emulator Suite kiểm tra policy. Cloud deploy cần được người dùng yêu cầu riêng.

## 5. Các task thực hiện sau approval

### Task 0 — Rules cho settlement details trước client read

**Files:** `firestore.rules`, `functions/tests/settlement-details-rules.emulator.test.cjs`. Reuse room membership Rules SL-016 và Rules harness/emulator SL-002/003.

- [ ] Chỉ thành viên của room đọc được `settlementDetails/current`; kiểm tra cả Host/member, anonymous, outsider và user room khác bằng client SDK.
- [ ] Cho phép chỉ transaction Host hợp lệ create/update; chặn member/outsider writes, list và delete.
- [ ] Kiểm tra expiry/read path theo contract, không log hoặc trả bank details ngoài room; Admin SDK chỉ dùng seed fixture.
- [ ] Chạy regression room/member Rules và ghi evidence; SL-037 sẽ re-test canonical policy.

### Task 1 — Boundary và quy tắc của Host nhập thông tin nhận tiền

**Files:** Spark repository và Rules; test boundary trong Emulator Suite. Không dùng callable/backend Functions.

**Nhận/trả:** Nhận Host, COMPLETED/FINALIZED room, bankId/accountNumber/accountName; trả Room-scoped details hết hạn sau 30 ngày tính từ `endedAt`.

- [ ] Đọc lại source/spec và xác nhận tất cả blocker cùng dependency cho task đã được giải quyết; nếu chưa, dừng execution và báo đúng blocker.
- [ ] Viết focused Rules cases; runner không tìm thấy hoặc thiếu dependency không được tính là red nghiệp vụ.

- [ ] Member submit → permission-denied.
- [ ] Room chưa COMPLETED → failed-precondition.
- [ ] Field rỗng/quá dài → invalid-argument ở client, Rules từ chối ghi ngoài schema.

- [ ] Chạy focused command trong mục 7; xác nhận failure đúng behavior đang thiếu, không từ toolchain lỗi.
- [ ] Xây hành vi theo thứ tự sau, chỉ sau approval:

1. Active Host-only trên COMPLETED/FINALIZED; validate non-empty và bounds theo contract.
2. Upsert document duy nhất; derive room end-time và expiry từ Firestore snapshot; Rules buộc timestamp cập nhật là request.time.
3. Membership/expiry Rules giới hạn read; không receipt/SQLite/logs/analytics chứa account details.

- [ ] Chạy lại các cases và đối chiếu output/invariants; không tuyên bố native/integration PASS từ mock.
- [ ] Review task và commit chỉ files thuộc task nếu execution được phép. Subject dùng `[2026-10-13-sl-023-settlement-details]`, trailer `Plan: docs/superpowers/plans/2026-10-13-sl-023-settlement-details.md` và `Task: 1`.

### Task 2 — Journey tích hợp và recovery

**Files:** Presentation/adapter/evidence trong mục 3 cùng boundary task 1; không refactor screen không liên quan. Task này không tạo implementation thứ hai cho unit task 1.

**Nhận:** Output task 1 đã kiểm chứng. **Trả:** Journey/bằng chứng có thể nghiệm thu; error/offline không false-success.

- [ ] Viết các failing cases về integration/recovery sau; không viết tests chỉ mirror implementation.

- [ ] Retry cùng payload → cùng document được upsert, không tạo bản ghi/receipt phụ.
- [ ] Non-member read → deny.
- [ ] Expiry → endedAt cộng 30 ngày, không từ device time.
- [ ] Thành viên cùng room đọc details → allowed; anonymous/outsider/cross-room → denied; direct client writes → denied trên Emulator Suite.
- [ ] Navigation test: summary pending chặn form; Host từ summary finalized mở được form; lưu thành công tiếp tục sang bill allocation; lỗi giữ form và dữ liệu nhập.

- [ ] Chạy focused checks, xác nhận failure đúng behavior; giữ fixtures tách khỏi device evidence.
- [ ] Tích hợp theo thứ tự:

1. Form blank/validation/loading/error; retry không mất data nhập.
2. Member chỉ đọc details được phép; invalid/expired/cached state phải rõ.
3. Bỏ hardcoded bank fixture khỏi production; details không dùng ngoài room.
4. Từ GroupSummary của room đã finalized/reconciled, Host mở form; Member không có đường gửi thông tin. Chỉ sau khi lưu thành công chuyển đến route bill allocation SL-024; lỗi giữ Host trên form với dữ liệu để retry.

- [ ] Thực hiện các kịch bản nghiệm thu trực tiếp trong mục 6; thu logs an toàn/device timestamps khi cần.
- [ ] Review kết quả; một branch fail hoặc thiếu required device/emulator evidence thì slice chưa hoàn thành.
- [ ] Commit task sau review nếu execution được phép. Subject dùng `[2026-10-13-sl-023-settlement-details]`, trailer `Plan: docs/superpowers/plans/2026-10-13-sl-023-settlement-details.md` và `Task: 2`.

## 6. Nghiệm thu và failure outcomes

- [ ] Member submit → permission-denied.
- [ ] Room chưa COMPLETED → failed-precondition.
- [ ] Field rỗng → invalid-argument.
- [ ] Retry cùng payload → upsert cùng document; không tạo receipt bổ sung.
- [ ] Non-member read → deny.
- [ ] Expiry → endedAt cộng 30 ngày, không từ device time.
- [ ] Host nhập, Member authorized thấy details; outsider không thấy.
- [ ] Error logging review → không có bank account/full payload.
- [ ] GroupSummary của room pending → không mở form; summary finalized/reconciled cho Host → mở form; Member không có submit entry.
- [ ] Lưu thành công → tiếp tục tới bill allocation; lỗi lưu → ở form, giữ dữ liệu và không báo thành công.

Mỗi case phải có actual result. Firebase boundary cần Rules Emulator Suite tests bằng client SDK cho allowed/denied/retry/lifecycle. Sensor/lifecycle cần physical devices. Không có evidence thì ghi UNVERIFIED và blocker, không tick PASS.

**Failure recovery bắt buộc:** không hiển thị successful save/transition khi commit/request chưa thành công; giữ dữ liệu/retry context theo hành vi cụ thể trong tasks. Không log email đầy đủ, token, activation code hoặc bank details. Case không áp dụng cho slice phải ghi lý do trong evidence, không bỏ im lặng.

## 7. Verification và ghi nhận evidence

Rules Suite: `pnpm --dir functions exec firebase emulators:exec --config ../firebase.emulator.json --project demo-dontlift-expo-go --only firestore "node --test tests/settlement-details-rules.emulator.test.cjs"`. TypeScript: `pnpm exec tsc --noEmit`. Lint: `pnpm run lint` chỉ khi repository có ESLint setup thực tế.

Lệnh app chạy từ `dontlift-mobile/`; file paths tests/backend ở trên là planned targets. Command chỉ được chạy sau harness/dependency prerequisites. Native build/emulator commands phải lấy từ cấu hình thật sau SL-002; không đoán project ID, runtime hoặc production alias. Future schema/index changes được test với approved edition Standard.

### Execution evidence — 2026-10-21

- `pnpm exec tsc --noEmit` — PASS (exit 0).
- `node --check tests/settlement-details-rules.emulator.test.cjs` (từ `dontlift-mobile/functions/`) — PASS (exit 0; chỉ kiểm tra cú pháp test).
- Rules Emulator Suite — UNVERIFIED: Firebase CLI không khởi chạy được Firestore Emulator vì `java -version` không chạy trên máy (`Could not spawn java -version`).
- Lint — UNVERIFIED: repo chưa có ESLint config/dependency; `expo lint` yêu cầu cài ESLint trong khi môi trường tắt network nên không hoàn tất.
- Expo Go visual/device flow — UNVERIFIED; chưa thao tác trên thiết bị ở lượt này.
- Cloud Rules deploy / Firebase project tier — chưa deploy/đọc lại trạng thái cloud trong lượt này; không bật billing.

Chỉ đánh dấu các acceptance item có actual evidence sau khi emulator hoặc thiết bị chạy thành công.

## 8. Human review và bàn giao P6.2

Human phải duyệt scope, non-goals, tasks, acceptance cases, dependencies và các quyết định còn mở của **SL-023** trước implementation. Duyệt một slice không duyệt tất cả 37; duyệt authoring batch không duyệt code.

Sau approval, cập nhật trạng thái/date/decision evidence trong đúng plan; kế hoạch mới chỉ đủ execution-ready khi blocker đã được giải quyết và baseline được re-inspect. Dùng qskill-executing-plans khi user yêu cầu execute plan đã duyệt. Không tự bắt đầu P6.2 từ file draft hoặc từ prompt batch.
