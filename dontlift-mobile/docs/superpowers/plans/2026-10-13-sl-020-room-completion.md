# Kế hoạch triển khai P6.1 — SL-020: Host complete và ALL_SYNCED reconciliation

> **For agentic workers:** REQUIRED SUB-SKILL: Use the qskill-executing-plans skill to implement this plan task-by-task. Steps use checkbox tracking.
> Kế hoạch chỉ mô tả file, unit, hành vi, quy tắc, đầu ra và test cases; không có implementation code hoặc signatures. Đọc source thật trước mỗi task.
> **Gate:** Không execute kế hoạch khi trạng thái còn DRAFT hoặc khi blocker/dependency chưa giải quyết. Việc tạo file này không phê duyệt backlog hay P6.2.

**Mục tiêu:** Host complete và ALL_SYNCED reconciliation: COMPLETED/PENDING rồi FINALIZED/ALL_SYNCED với frozen canonical scores.

**Slice:** SL-020. **Ưu tiên đề xuất:** P0. **Release:** MVP + activation/Premium; post-MVP deferred. SL-036 chỉ được tính release sau D6.

**Trạng thái kế hoạch:** DRAFT — chưa được human duyệt.
**Trạng thái implementation quan sát:** End chỉ navigate sang bill, không reconcile. Chưa có evidence nghiệm thu slice.
**Baseline khảo sát:** docs/p6.0-implementation-slices tại 57ca1eb28a2952c66d01f89b9b89bf755ab4812a.
**Ngày soạn:** 2026-10-13, Asia/Saigon.
**Plan slug:** `2026-10-13-sl-020-room-completion`; mọi commit thực hiện plan này phải bắt đầu `[2026-10-13-sl-020-room-completion]`.
**Đầu vào phạm vi:** Backlog P6.0 v0.1 trong cuộc trò chuyện ngày 2026-10-13, chưa được phê duyệt. User đã yêu cầu ghi draft P6.1 cho cả 37 slice; không suy thành approval thực thi.
**Traceability:** US-12; API §5.1–5.2; ADR-003; V06.
**Phụ thuộc bắt buộc:** [SL-017](./2026-10-13-sl-017-group-active.md)
**Ưu tiên mềm:** Theo thứ tự đề xuất trong [mục lục](../../implementation-plan.md); thứ tự không tạo thêm hard dependency.

## 1. Nguồn và ranh giới

Đọc [PRD](../../product-requirements.md), [Feature Spec](../../feature-specification.md), [Product Design](../../product-design.md), [Design Brief](../../product-design-brief.md), [Architecture](../../software-architecture.md), [API contracts](../../api-contracts.md), ADR áp dụng trong [decisions](../../decisions), cùng AGENTS ở app root. Tham chiếu cụ thể của slice nằm trong Traceability phía trên.

V01–V10 chỉ các màn tương ứng tại `design/concepts/concept-final/screens/`; prototype nằm tại `prototype/`. Chúng là read-only visual/interaction references, không chứng minh integration. Nếu journey không có design screen, trình bày gap với human trước quyết định UI mới.

**Kiến trúc:** completeRoom và acknowledgeMemberSync sở hữu hành vi của slice. Presentation đọc kết quả qua controller/repository; không tự trở thành nguồn authoritative. Units và đường dẫn mới bên dưới là đề xuất, chưa tồn tại trên baseline; nếu prerequisite đã tạo cùng trách nhiệm thì reuse, không thêm convention thứ hai.

**Stack:** Expo SDK 57 / React Native / TypeScript. SQLite cho local-first khi slice có persistence; React Native Firebase Auth/Firestore Standard/Functions cho boundary có Firebase. Không bắt slice thuần local phải có network.

**Không gồm:** HOST_OVERRIDE, bill calculation, infinite-wait policy tự thay đổi.

## 2. Blocker, risk và quyết định cần duyệt

- Không có blocker riêng được xác nhận trong draft; dependency và quyền/runtime vẫn phải đạt gate trước thực thi.

**Rủi ro cụ thể:** In-flight flush/ACK race; field pendingMemberUids Host-only.

Nếu một contract chỉ có responsibility mà chưa có schema, task đầu là trình bày missing decision với nguồn; không tự tạo endpoint/field mới. Các hành vi test bên dưới mô tả outcome cần đạt, không thay thế wire approval. Ngưỡng/range/default chưa được spec xác định phải có quyết định ghi lại trước khi implement.

## 3. File và quyền sở hữu dự kiến

Các đường dẫn sau tương đối với `dontlift-mobile/`. Đọc lại trạng thái file lúc execute để chọn Create/Modify; không ghi đè implementation của dependency.

| File dự kiến | Trách nhiệm |
|---|---|
| `src/features/rooms/completion-controller.ts` | Unit/repository/adapter chuyên trách; reuse nếu prerequisite đã tạo. |
| `src/screens/GroupSummaryScreen.tsx` | Presentation và states của journey; không chứa domain math/sync authority. |
| `src/screens/GroupActiveScreen.tsx` | Thay End callback đang nhảy thẳng sang bill bằng completion request và chuyển vào GroupSummaryScreen. |
| `src/app/index.tsx` | Đăng ký GroupSummary screen state/rendering và route transition từ GroupActive. |
| `src/types.ts` | Bổ sung ScreenId cho GroupSummary. |
| `src/constants.ts` | Bổ sung title cho GroupSummary theo ScreenId. |
| `functions/src/complete-room.cjs` | Backend boundary của slice; server identity/validation/transaction. |
| `functions/src/acknowledge-member-sync.cjs` | Backend boundary của slice; server identity/validation/transaction. |
| `functions/index.js` | Backend boundary của slice; server identity/validation/transaction. |
| `__tests__/room-completion.test.ts` | Kiểm thử dự kiến; chưa tạo test source trong P6.1. |
| `__tests__/room-completion-navigation.test.ts` | Kiểm chứng End → GroupSummary, PENDING gate và ALL_SYNCED continuation; không dùng mock để claim Rules/Functions integration. |
| `functions/tests/room-completion.test.cjs` | Kiểm thử dự kiến; chưa tạo test source trong P6.1. |

**Unit:** completeRoom và acknowledgeMemberSync.
**Nhận:** ACTIVE room, Host complete và Members đã flush tới endedAt.
**Trả:** COMPLETED/PENDING rồi FINALIZED/ALL_SYNCED với frozen canonical scores.
**Đầu vào từ dependency:** capabilities/records/commands đã nghiệm thu theo các plan liên kết; chưa có dependency output thì không giả coi integration có thật.
**Đầu ra cho slice sau:** outcome và invariants trong mục tiêu/nghiệm thu dưới đây; tên internal unit là đề xuất, wire names chỉ dùng theo API/ADR đã duyệt.

### Contract dữ liệu đã có

Bảng dưới là trích ranh giới từ API đã duyệt, không tạo schema mới. Common response giữ version/requestId/serverTimeUtcMs khi contract yêu cầu; full required fields/errors/transaction outputs vẫn theo API section được tham chiếu.

| Field | Bắt buộc / hướng | Quy tắc |
|---|---|---|
| version | Bắt buộc | 1, theo common envelope. |
| requestId | Bắt buộc | UUID; cùng actor/payload replay trả prior outcome, payload khác bị collision. |
| roomId | Bắt buộc | UUID room, cho completeRoom và acknowledgeMemberSync. |
| syncedThroughUtcMs | Chỉ ACK | Integer covering authoritative endedAt; server verify flush. |
| reconciliationStatus | Response | PENDING hoặc FINALIZED; response chi tiết theo API §5. |

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

### Task 1 — Boundary và quy tắc của Host complete và ALL_SYNCED reconciliation

**Files:** Dùng units/config/backend/repositories trong bảng mục 3; khi test source đã được chỉ định, đặt cases thuộc boundary vào đúng app/backend target. Không thay presentation chưa cần cho task này.

**Nhận/trả:** Nhận ACTIVE room, Host complete và Members đã flush tới endedAt; trả COMPLETED/PENDING rồi FINALIZED/ALL_SYNCED với frozen canonical scores. Với contract đang bị chặn, chưa có quyền thêm schema dù test outcome đã được nêu.

- [ ] Đọc lại source/spec và xác nhận tất cả blocker cùng dependency cho task đã được giải quyết; nếu chưa, dừng execution và báo đúng blocker.
- [ ] Viết focused failing cases sau đây; runner không tìm thấy hoặc thiếu dependency không được tính là red nghiệp vụ.

- [ ] Non-Host complete → deny.
- [ ] Duplicate complete → endedAt và pending count không đổi.
- [ ] Member ACK trước đủ flush → failed-precondition.

- [ ] Chạy focused command trong mục 7; xác nhận failure đúng behavior đang thiếu, không từ toolchain lỗi.
- [ ] Xây hành vi theo thứ tự sau, chỉ sau approval:

1. Host-only complete freezes endedAt và pending relevant Members trong transaction/receipt.
2. Member flush eligible events rồi ACK through authoritative endedAt; server verify completeness.
3. ACK count giảm một lần; zero pending atomically finalizes ALL_SYNCED, bill gate mở.

- [ ] Chạy lại các cases và đối chiếu output/invariants; không tuyên bố native/integration PASS từ mock.
- [ ] Review task và commit chỉ files thuộc task nếu execution được phép. Subject dùng `[2026-10-13-sl-020-room-completion]`, trailer `Plan: docs/superpowers/plans/2026-10-13-sl-020-room-completion.md` và `Task: 1`.

### Task 2 — Journey tích hợp và recovery

**Files:** Presentation/adapter/evidence trong mục 3 cùng boundary task 1; không refactor screen không liên quan. Task này không tạo implementation thứ hai cho unit task 1.

**Nhận:** Output task 1 đã kiểm chứng. **Trả:** Journey/bằng chứng có thể nghiệm thu; error/offline không false-success.

- [ ] Viết các failing cases về integration/recovery sau; không viết tests chỉ mirror implementation.

- [ ] Duplicate ACK → count giảm một lần.
- [ ] ACK cuối cùng → ALL_SYNCED và FINALIZED.
- [ ] Bill request khi PENDING → bị chặn.

- [ ] Chạy focused checks, xác nhận failure đúng behavior; giữ fixtures tách khỏi device evidence.
- [ ] Tích hợp theo thứ tự:

1. Tất cả participants thấy summary/reconciliation state; không navigate bill giả ngay End.
2. Network/service failure giữ retry context; unsynced Member hiển thị riêng cho Host.
3. Early-exit/cancel/abort ownership không được tự suy; eligibility cần khớp accepted contract.
4. GroupActive End → gọi completeRoom rồi mở GroupSummaryScreen; PENDING không mở settlement/bill flow, FINALIZED/ALL_SYNCED mới cho phép tiếp tục. SL-021 mở rộng cùng route bằng Host-override state/warning, không tạo luồng summary thứ hai.

- [ ] Thực hiện các kịch bản nghiệm thu trực tiếp trong mục 6; thu logs an toàn/device timestamps khi cần.
- [ ] Review kết quả; một branch fail hoặc thiếu required device/emulator evidence thì slice chưa hoàn thành.
- [ ] Commit task sau review nếu execution được phép. Subject dùng `[2026-10-13-sl-020-room-completion]`, trailer `Plan: docs/superpowers/plans/2026-10-13-sl-020-room-completion.md` và `Task: 2`.

## 6. Nghiệm thu và failure outcomes

- [ ] Non-Host complete → deny.
- [ ] Duplicate complete → endedAt và pending count không đổi.
- [ ] Member ACK trước đủ flush → failed-precondition.
- [ ] Duplicate ACK → count giảm một lần.
- [ ] ACK cuối cùng → ALL_SYNCED và FINALIZED.
- [ ] Bill request khi PENDING → bị chặn.
- [ ] End từ GroupActive → GroupSummaryScreen hiển thị PENDING và chặn bill/settlement navigation.
- [ ] ALL_SYNCED/FINALIZED → GroupSummaryScreen cho phép continuation tới bước settlement kế tiếp.
- [ ] Host override theo SL-021 → cùng summary route hiển thị trạng thái/warning thay vì bỏ qua summary.
- [ ] Hai devices, một có pending event → completion chưa finalized tới khi đủ flush/ACK.
- [ ] Verify final scores và summary server/local; no client override.
- [ ] Host/Member vẫn đọc room/member reconciliation projection theo Rules SL-016; anonymous/outsider/cross-room bị deny và client không ghi status/scores.

Mỗi case phải có actual result. Unit cases dùng controlled fixtures để chứng minh domain; Firebase boundary cần Rules/Functions emulator tests cho allowed/denied/replay/concurrency khi áp dụng. Sensor/lifecycle cần physical devices. Không có evidence thì ghi UNVERIFIED và blocker, không tick PASS.

**Failure recovery bắt buộc:** không hiển thị successful save/transition khi commit/request chưa thành công; giữ dữ liệu/retry context theo hành vi cụ thể trong tasks. Không log email đầy đủ, token, activation code hoặc bank details. Case không áp dụng cho slice phải ghi lý do trong evidence, không bỏ im lặng.

## 7. Verification và ghi nhận evidence

App focused tests sau khi SL-001 cấu hình runner: `pnpm test --runTestsByPath __tests__/room-completion.test.ts __tests__/room-completion-navigation.test.ts`. Backend focused tests sau backend bootstrap SL-003 và native/emulator prerequisites SL-002: `node --test functions/tests/room-completion.test.cjs`. TypeScript: `pnpm exec tsc --noEmit`. Lint: `pnpm run lint` chỉ khi repository có ESLint setup thực tế.

Lệnh app chạy từ `dontlift-mobile/`; file paths tests/backend ở trên là planned targets. Command chỉ được chạy sau harness/dependency prerequisites. Native build/emulator commands phải lấy từ cấu hình thật sau SL-002; không đoán project ID, runtime hoặc production alias. Future schema/index changes được test với approved edition Standard.

Ghi trong kết quả execution: baseline/commit mới, command, exit status, số cases, emulator/device/runtime version, date, actual outcomes và remaining gaps. Các checklist hiện đều chưa chạy.

## 8. Human review và bàn giao P6.2

Human phải duyệt scope, non-goals, tasks, acceptance cases, dependencies và các quyết định còn mở của **SL-020** trước implementation. Duyệt một slice không duyệt tất cả 37; duyệt authoring batch không duyệt code.

Sau approval, cập nhật trạng thái/date/decision evidence trong đúng plan; kế hoạch mới chỉ đủ execution-ready khi blocker đã được giải quyết và baseline được re-inspect. Dùng qskill-executing-plans khi user yêu cầu execute plan đã duyệt. Không tự bắt đầu P6.2 từ file draft hoặc từ prompt batch.
