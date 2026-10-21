# Kế hoạch triển khai P6.1 — SL-021: Host override khi còn Member chưa sync

> **For agentic workers:** REQUIRED SUB-SKILL: Use the qskill-executing-plans skill to implement this plan task-by-task. Steps use checkbox tracking.
> Kế hoạch chỉ mô tả file, unit, hành vi, quy tắc, đầu ra và test cases; không có implementation code hoặc signatures. Đọc source thật trước mỗi task.
> **Gate:** Không execute kế hoạch nếu trạng thái còn DRAFT hoặc dependency/blocker chưa giải quyết. Phê duyệt này chỉ áp dụng cho SL-021, không phê duyệt backlog hay P6.2.

**Mục tiêu:** Host override khi còn Member chưa sync: FINALIZED/HOST_OVERRIDE, append-only audit; late events history-only.

**Slice:** SL-021. **Ưu tiên đề xuất:** P1. **Release:** MVP + activation/Premium; post-MVP deferred. SL-036 chỉ được tính release sau D6.

**Trạng thái kế hoạch:** APPROVED — human chọn giữ Firebase Spark/free tier và duyệt ngoại lệ transaction + Rules ngày 2026-10-21.
**Trạng thái implementation quan sát:** Host override warning, Spark transaction, audit và late-event history-only path đã được triển khai trong working tree. Chưa đủ evidence Rules Emulator và thiết bị để hoàn tất slice.
**Baseline khảo sát:** docs/p6.0-implementation-slices tại 57ca1eb28a2952c66d01f89b9b89bf755ab4812a.
**Ngày soạn:** 2026-10-13, Asia/Saigon.
**Plan slug:** `2026-10-13-sl-021-host-finalization-override`; mọi commit thực hiện plan này phải bắt đầu `[2026-10-13-sl-021-host-finalization-override]`.
**Đầu vào phạm vi:** Human approval ngày 2026-10-21 để thực hiện riêng SL-021 trên Spark; không suy thành approval cho các slice khác.
**Traceability:** API §5.3; ARCH §8.7; ADR-003; ADR-018.
**Phụ thuộc bắt buộc:** [SL-020](./2026-10-13-sl-020-room-completion.md)
**Ưu tiên mềm:** Theo thứ tự đề xuất trong [mục lục](../../implementation-plan.md); thứ tự không tạo thêm hard dependency.

## 1. Nguồn và ranh giới

Đọc [PRD](../../product-requirements.md), [Feature Spec](../../feature-specification.md), [Product Design](../../product-design.md), [Design Brief](../../product-design-brief.md), [Architecture](../../software-architecture.md), [API contracts](../../api-contracts.md), ADR áp dụng trong [decisions](../../decisions), cùng AGENTS ở app root. Tham chiếu cụ thể của slice nằm trong Traceability phía trên.

V01–V10 chỉ các màn tương ứng tại `design/concepts/concept-final/screens/`; prototype nằm tại `prototype/`. Chúng là read-only visual/interaction references, không chứng minh integration. Nếu journey không có design screen, trình bày gap với human trước quyết định UI mới.

**Kiến trúc:** finalizeRoomScores là Firestore client transaction được Rules authorize theo ADR-018. Presentation đọc kết quả qua controller/repository; không tự trở thành nguồn authoritative. Dùng score documents hiện hữu làm snapshot bất biến; audit là document create-only trong cùng transaction. Không dùng Cloud Functions, billing hoặc scheduled service.

**Stack:** Expo SDK 57 / React Native / TypeScript. SQLite cho local-first; Firebase JS SDK Auth/Firestore Standard, transaction và Security Rules trên Spark. Lệnh cần mạng và không queue offline.

**Không gồm:** Silent/time-based override, deleting late violations.

## 2. Blocker, risk và quyết định cần duyệt

- **Resolved 2026-10-21:** Host override chạy trên Spark theo ADR-018. Audit ghi pending UIDs mà Host quan sát từ room roster; Firestore Rules không xác minh được tính đầy đủ của danh sách này. Không mô tả nó như server-verified.

**Rủi ro cụ thể:** Override/ACK transaction contention và audit privacy.

Nếu một contract chỉ có responsibility mà chưa có schema, task đầu là trình bày missing decision với nguồn; không tự tạo endpoint/field mới. Các hành vi test bên dưới mô tả outcome cần đạt, không thay thế wire approval. Ngưỡng/range/default chưa được spec xác định phải có quyết định ghi lại trước khi implement.

## 3. File và quyền sở hữu dự kiến

Các đường dẫn sau tương đối với `dontlift-mobile/`. Đọc lại trạng thái file lúc execute để chọn Create/Modify; không ghi đè implementation của dependency.

| File dự kiến | Trách nhiệm |
|---|---|
| `src/features/rooms/room-completion-repository.ts` | Spark transaction, replay and idempotent outcome; reuse existing completion boundary. |
| `src/features/rooms/room-listener.ts` | Project HOST_OVERRIDE state for the existing summary UI. |
| `src/features/rooms/group-violation-repository.ts` | Append eligible post-finalization events as history-only; no score mutation. |
| `firestore.rules` | Exact Host override/audit link and history-only violation rules; freeze final scores. |
| `src/screens/GroupSummaryScreen.tsx` | Host warning, confirmation and pending-member summary on existing route. |
| `src/app/index.tsx` | Wire override action and retryable state into existing Group Summary. |
| `functions/tests/host-finalization-override.rules.emulator.test.cjs` | Emulator coverage for host/member/outsider, audit linkage, idempotency, frozen score and late history. |

**Unit:** finalizeRoomScores.
**Nhận:** Host confirmation đúng warning, PENDING room và unsynced membership.
**Trả:** FINALIZED/HOST_OVERRIDE, append-only audit; late events history-only. Audit's UID list is explicitly Host-observed, not Rules-verified.
**Đầu vào từ dependency:** capabilities/records/commands đã nghiệm thu theo các plan liên kết; chưa có dependency output thì không giả coi integration có thật.
**Đầu ra cho slice sau:** outcome và invariants trong mục tiêu/nghiệm thu dưới đây; tên internal unit là đề xuất, wire names chỉ dùng theo API/ADR đã duyệt.

### Contract dữ liệu đã có

Bảng dưới là trích ranh giới từ API đã duyệt, không tạo schema mới. Common response giữ version/requestId/serverTimeUtcMs khi contract yêu cầu; full required fields/errors/transaction outputs vẫn theo API section được tham chiếu.

| Field | Bắt buộc / hướng | Quy tắc |
|---|---|---|
| version | Bắt buộc | 1, theo common envelope. |
| requestId | Bắt buộc | UUID; cùng actor/payload replay trả prior outcome, payload khác bị collision. |
| roomId | Bắt buộc | UUID. |
| reason | Bắt buộc | HOST_OVERRIDE. |
| confirmedWarning | Bắt buộc | true sau human confirmation đúng warning. |

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

## 5. Các task implementation

### Task 1 — Boundary và quy tắc của Host override khi còn Member chưa sync

**Files:** Dùng units/config/backend/repositories trong bảng mục 3; khi test source đã được chỉ định, đặt cases thuộc boundary vào đúng app/backend target. Không thay presentation chưa cần cho task này.

**Nhận/trả:** Nhận Host confirmation đúng warning, PENDING room và unsynced membership; trả FINALIZED/HOST_OVERRIDE, append-only audit; late events history-only. Audit UID list là Host-observed attestation; Rules không chứng minh được tính đầy đủ.

- [ ] Đọc lại source/spec và xác nhận tất cả blocker cùng dependency cho task đã được giải quyết; nếu chưa, dừng execution và báo đúng blocker.
- [ ] Viết focused failing cases sau đây; runner không tìm thấy hoặc thiếu dependency không được tính là red nghiệp vụ.

- [ ] Không confirmedWarning → invalid-argument.
- [ ] Member override → permission-denied.
- [ ] Same request replay → một audit.

- [ ] Chạy focused command trong mục 7; xác nhận failure đúng behavior đang thiếu, không từ toolchain lỗi.
- [ ] Xây hành vi theo thứ tự sau, chỉ sau approval:

1. Hiện đúng warning: Some Members have not synced. Late violations will not affect payment.
2. Require explicit confirmation and active Host identity; finalize the room and create an immutable audit in one Spark transaction.
3. Record actor/request/Host-observed unsynced UIDs/end time/frozen score reference. Rules link the audit and transition; they cannot prove UID-list completeness.

- [ ] Chạy lại các cases và đối chiếu output/invariants; không tuyên bố native/integration PASS từ mock.
- [ ] Review task và commit chỉ files thuộc task nếu execution được phép. Subject dùng `[2026-10-13-sl-021-host-finalization-override]`, trailer `Plan: docs/superpowers/plans/2026-10-13-sl-021-host-finalization-override.md` và `Task: 1`.

### Task 2 — Journey tích hợp và recovery

**Files:** Presentation/adapter/evidence trong mục 3 cùng boundary task 1; không refactor screen không liên quan. Task này không tạo implementation thứ hai cho unit task 1.

**Nhận:** Output task 1 đã kiểm chứng. **Trả:** Journey/bằng chứng có thể nghiệm thu; error/offline không false-success.

- [ ] Viết các failing cases về integration/recovery sau; không viết tests chỉ mirror implementation.

- [ ] Override khi đã finalized → safe contract error.
- [ ] Late valid event → excludedFromFinalScore, bill giữ nguyên.
- [ ] Concurrent last ACK/override → một terminal finalization.
- [ ] Chạy Rules Emulator → Host-only finalization, one audit per request, and history-only late events; frozen scores remain unchanged.

- [ ] Chạy focused checks, xác nhận failure đúng behavior; giữ fixtures tách khỏi device evidence.
- [ ] Tích hợp theo thứ tự:

1. Không confirm → không command; loading/error cho phép safe retry.
2. Late valid event vẫn vào history với exclusion reason HOST_OVERRIDE; không sửa frozen score/bill.
3. ACK cuối và override đồng thời → một finalization canonical, không hai outcomes mâu thuẫn.
4. Không thêm Cloud Functions hoặc thay bootstrap của `syncEvents`.

- [ ] Thực hiện các kịch bản nghiệm thu trực tiếp trong mục 6; thu logs an toàn/device timestamps khi cần.
- [ ] Review kết quả; một branch fail hoặc thiếu required device/emulator evidence thì slice chưa hoàn thành.
- [ ] Commit task sau review nếu execution được phép. Subject dùng `[2026-10-13-sl-021-host-finalization-override]`, trailer `Plan: docs/superpowers/plans/2026-10-13-sl-021-host-finalization-override.md` và `Task: 2`.

## 6. Nghiệm thu và failure outcomes

- [ ] Không confirmedWarning → invalid-argument.
- [ ] Member override → permission-denied.
- [ ] Same request replay → một audit.
- [ ] Override khi đã finalized → safe contract error.
- [ ] Late valid event → excludedFromFinalScore, bill giữ nguyên.
- [ ] Concurrent last ACK/override → một terminal finalization.
- [ ] Host confirm khi một device offline → inspect audit và warning evidence.
- [ ] Device offline reconnect → history cập nhật, QR/bill không thay đổi.
- [ ] Rules Emulator → only active Host can finalize; audit/room transition atomic; replay creates one audit; late history cannot change scores.

Mỗi case phải có actual result. Firebase boundary cần Rules Emulator tests cho allowed/denied/replay/concurrency. Sensor/lifecycle cần physical devices. Không có evidence thì ghi UNVERIFIED và blocker, không tick PASS.

**Failure recovery bắt buộc:** không hiển thị successful save/transition khi commit/request chưa thành công; giữ dữ liệu/retry context theo hành vi cụ thể trong tasks. Không log email đầy đủ, token, activation code hoặc bank details. Case không áp dụng cho slice phải ghi lý do trong evidence, không bỏ im lặng.

## 7. Verification và ghi nhận evidence

Focused app tests: `pnpm test -- --runInBand __tests__/room-host-finalization-override.test.ts __tests__/group-violation-repository.test.ts`. Rules tests: `node --test functions/tests/host-finalization-override.rules.emulator.test.cjs` within the configured Firestore Emulator Suite (Java required). TypeScript: `pnpm exec tsc --noEmit`. Lint: `pnpm run lint` chỉ khi repository có ESLint setup thực tế.

Lệnh app chạy từ `dontlift-mobile/`; file paths tests/backend ở trên là planned targets. Command chỉ được chạy sau harness/dependency prerequisites. Native build/emulator commands phải lấy từ cấu hình thật sau SL-002; không đoán project ID, runtime hoặc production alias. Future schema/index changes được test với approved edition Standard.

### Evidence hiện tại — 2026-10-21

- `node node_modules/typescript/bin/tsc --noEmit` từ `dontlift-mobile/`: PASS (exit 0).
- `node node_modules/jest/bin/jest.js --runInBand __tests__/room-host-finalization-override.test.ts __tests__/group-violation-repository.test.ts`: PASS (2 suites, 6 tests).
- `git diff --check`: PASS (exit 0).
- `pnpm run test:emulators` chưa chạy được: Firebase CLI báo `Could not spawn java -version`; Rules Emulator cases vẫn UNVERIFIED.
- Full app suite trước đó: 32/34 suites pass; hai suite hiện hữu `local-database.test.ts` và `room-lobby-projection.test.ts` fail do kỳ vọng schema/projection cũ (SQLite v8/6 columns trong khi baseline hiện tại là v9/9 columns). Chưa thay đổi các test/file này.
- Chưa chạy Expo Go/device acceptance, concurrency ACK/override trên Emulator, hoặc production Rules deploy. Không bật billing và không deploy Functions.

Các checklist nghiệm thu chưa có evidence phải giữ UNVERIFIED; thiếu Java và thiết bị là blocker xác minh, không phải PASS.

## 8. Human review và bàn giao P6.2

Human approved the Spark scope, non-goals, tasks, acceptance cases and audit limitation for **SL-021** on 2026-10-21. This approval does not authorize enabling billing, deploying Functions, or production Rules deployment.

Kế hoạch đã được duyệt và implementation đang ở working tree. Hoàn tất các evidence còn thiếu trước khi đánh dấu slice xong. Không bắt đầu P6.2 từ kế hoạch này.
