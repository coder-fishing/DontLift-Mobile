# Kế hoạch triển khai P6.1 — SL-020: Host complete và ALL_SYNCED reconciliation

> **For agentic workers:** REQUIRED SUB-SKILL: Use the qskill-executing-plans skill to implement this plan task-by-task. Steps use checkbox tracking.
> Kế hoạch chỉ mô tả file, unit, hành vi, quy tắc, đầu ra và test cases; không có implementation code hoặc signatures. Đọc source thật trước mỗi task.
> **Gate:** Không execute kế hoạch khi trạng thái còn DRAFT hoặc khi blocker/dependency chưa giải quyết. Việc tạo file này không phê duyệt backlog hay P6.2.

**Mục tiêu:** Host complete và ALL_SYNCED reconciliation: COMPLETED/PENDING rồi FINALIZED/ALL_SYNCED với frozen canonical scores.

**Slice:** SL-020. **Ưu tiên đề xuất:** P0. **Release:** MVP + activation/Premium; post-MVP deferred. SL-036 chỉ được tính release sau D6.

**Trạng thái kế hoạch:** APPROVED — human yêu cầu tiếp tục trên Firebase Spark ngày 2026-10-21; D3 policy đã chốt tại ADR-015 và Spark exception được ghi tại ADR-017.
**Trạng thái implementation quan sát:** Spark completion/ACK, reconciliation summary và terminal-room recovery đã được thêm vào working tree. TypeScript check đã chạy; Rules Emulator và Expo Go chưa được xác minh.
**Baseline khảo sát:** docs/p6.0-implementation-slices tại 57ca1eb28a2952c66d01f89b9b89bf755ab4812a.
**Ngày soạn:** 2026-10-13, Asia/Saigon.
**Plan slug:** `2026-10-13-sl-020-room-completion`; mọi commit thực hiện plan này phải bắt đầu `[2026-10-13-sl-020-room-completion]`.
**Đầu vào phạm vi:** Backlog P6.0 v0.1 trong cuộc trò chuyện ngày 2026-10-13, chưa được phê duyệt. User đã yêu cầu ghi draft P6.1 cho cả 37 slice; không suy thành approval thực thi.
**Traceability:** US-12; API §5.1–5.2; ADR-003; V06.
**Phụ thuộc bắt buộc:** [SL-017](./2026-10-13-sl-017-group-active.md), [SL-018](./2026-10-13-sl-018-early-exit.md)
**Ưu tiên mềm:** Theo thứ tự đề xuất trong [mục lục](../../implementation-plan.md); thứ tự không tạo thêm hard dependency.

## 1. Nguồn và ranh giới

Đọc [PRD](../../product-requirements.md), [Feature Spec](../../feature-specification.md), [Product Design](../../product-design.md), [Design Brief](../../product-design-brief.md), [Architecture](../../software-architecture.md), [API contracts](../../api-contracts.md), ADR áp dụng trong [decisions](../../decisions), cùng AGENTS ở app root. Tham chiếu cụ thể của slice nằm trong Traceability phía trên.

V01–V10 chỉ các màn tương ứng tại `design/concepts/concept-final/screens/`; prototype nằm tại `prototype/`. Chúng là read-only visual/interaction references, không chứng minh integration. Nếu journey không có design screen, trình bày gap với human trước quyết định UI mới.

**Kiến trúc:** completeRoom và acknowledgeMemberSync sở hữu hành vi của slice. Presentation đọc kết quả qua controller/repository; không tự trở thành nguồn authoritative. Units và đường dẫn mới bên dưới là đề xuất, chưa tồn tại trên baseline; nếu prerequisite đã tạo cùng trách nhiệm thì reuse, không thêm convention thứ hai.

**Stack:** Expo SDK 57 / React Native / TypeScript. SQLite cho local-first; Firebase JS SDK Auth/Firestore Standard, Firestore transactions và Security Rules trên Spark. Không dùng Cloud Functions, bật billing hay scheduled service. Các command cần mạng và không queue offline.

**Không gồm:** HOST_OVERRIDE, bill calculation, infinite-wait policy tự thay đổi.

## 2. Blocker, risk và quyết định cần duyệt

- **D3 — resolved:** ADR-015 quy định event kết thúc trước/đúng cutoff được tính; event kết thúc sau cutoff không tăng score; eligible late event còn pending để SL-020 nhận trước ACK. Completion và event ingestion cùng ghi room/member nên Firestore transaction conflict serialize theo state. Rules không thể xác minh SQLite outbox: ACK là client attestation sau local check, với rủi ro client tùy biến ACK sớm được nêu trong ADR-017.

**Rủi ro cụ thể:** Rules không chứng minh được local outbox đã drain; room không có timeout nên có thể PENDING vô hạn; in-flight flush/ACK race; pending UID list được suy ra từ listener thay vì transaction response.

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
| `src/features/rooms/room-completion-repository.ts` | Spark transaction cho Host completion và member ACK; local outbox gate trước ACK. |
| `firestore.rules` | Exact completion, ACK, late eligible violation và finalized score invariants theo ADR-017. |
| `src/features/rooms/room-listener.ts` | Reconciliation fields và per-member acknowledgment projection. |
| `src/features/rooms/group-violation-repository.ts` | Flush eligible events sau room completion nhưng trước member ACK. |
| `src/screens/GroupSummaryScreen.tsx` | Summary, pending roster, own-sync state, retry và finalized state. |
| `src/screens/GroupActiveScreen.tsx` | Host End confirmation, progress/error và điều hướng sang summary sau commit. |
| `src/app/index.tsx` | Gắn completion/ACK repositories, giữ room projection, summary transition và local retry. |
| `src/types.ts`, `src/constants.ts` | Bổ sung ScreenId và title cho GroupSummary. |
| `docs/decisions/ADR-017-spark-room-completion.md` | Ghi Spark authority boundary và giới hạn ACK attestation. |

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
| syncedThroughAt | Member | Set bằng authoritative `room.endedAt` trong ACK transaction; không phải chứng cứ server đọc được SQLite. |
| reconciliationStatus | Room | `PENDING` đến ACK cuối; `FINALIZED` khi pending count về 0. |

## 4. Ràng buộc xuyên suốt

- Giữ approved architecture; newer human decisions và accepted ADR exceptions thắng prose cũ.
- Không sao chép Firebase token vào SQLite, AsyncStorage hoặc SecureStore; SDK quản lý session.
- Event offline-capable dùng SQLite domain record và sync_outbox trong một transaction; syncEvents là ingestion authority.
- Command lifecycle/vote/bill/payment không queue để replay muộn. Firestore cache không thay thế outbox.
- Membership authority là rooms/{roomId}/members/{uid}. Với ADR-017, Rules authorize chính xác caller và transaction writes; không dùng Functions/Admin SDK.
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
- [ ] Approved early-exit Member có eligible pre-cutoff event chưa đến server → complete vẫn giữ reconciliation PENDING cho tới khi event durable và ACK hợp lệ.

- [ ] Chạy focused command trong mục 7; xác nhận failure đúng behavior đang thiếu, không từ toolchain lỗi.
- [ ] Xây hành vi theo thứ tự sau, chỉ sau approval:

1. Host-only complete ghi `endedAt = request.time`, `PENDING`, count=`participantCount`, và completion request marker trong transaction; Member `EARLY_EXIT` vẫn nằm trong count.
2. App flushes mọi local event eligible theo room end và early-exit cutoff. Rules nhận event đến muộn chỉ khi room PENDING, member chưa ACK và event nằm trong cutoff; event post-cutoff bị loại.
3. Client đọc local outbox pending count; nếu còn thì không ACK. Rules liên kết Member ACK với room decrement và khóa event mới cho Member đó sau ACK.
4. ACK count giảm một lần; zero pending atomically finalizes `ALL_SYNCED`; bill gate đọc reconciliation status và vẫn đóng khi `PENDING`.

- [ ] Chạy lại các cases và đối chiếu output/invariants; không tuyên bố native/integration PASS từ mock.
- [ ] Review task và commit chỉ files thuộc task nếu execution được phép. Subject dùng `[2026-10-13-sl-020-room-completion]`, trailer `Plan: docs/superpowers/plans/2026-10-13-sl-020-room-completion.md` và `Task: 1`.

### Task 2 — Journey tích hợp và recovery

**Files:** Presentation/adapter/evidence trong mục 3 cùng boundary task 1; không refactor screen không liên quan. Task này không tạo implementation thứ hai cho unit task 1.

**Nhận:** Output task 1 đã kiểm chứng. **Trả:** Journey/bằng chứng có thể nghiệm thu; error/offline không false-success.

- [ ] Viết các failing cases về integration/recovery sau; không viết tests chỉ mirror implementation.

- [ ] Duplicate ACK → count giảm một lần.
- [ ] ACK cuối cùng → ALL_SYNCED và FINALIZED.
- [ ] Room complete sau approved early exit có pending pre-cutoff event → không finalize sớm hoặc kẹt PENDING sau khi eligible event đã durable và Member ACKs through endedAt.
- [ ] Bill request khi PENDING → bị chặn.

- [ ] Chạy focused checks, xác nhận failure đúng behavior; giữ fixtures tách khỏi device evidence.
- [ ] Tích hợp theo thứ tự:

1. Tất cả participants thấy summary/reconciliation state; không navigate sang bill trước finalization.
2. Network/service failure giữ retry context; danh sách unsynced Member được Host suy ra từ roster listener.
3. Early-exit Member vẫn nằm trong membership/history/settlement; pending set và ACK chỉ được chốt sau khi mọi event eligible trước cutoff được xử lý theo SL-018/D3.
4. Event sau cutoff không tăng frozen exit stats; event trước cutoff đến sau room completion vẫn được xử lý đúng contract, và ACK không thể làm receipt/aggregate bị bỏ qua.
5. GroupActive End → transaction completeRoom rồi mở GroupSummaryScreen; PENDING không mở settlement/bill flow. FINALIZED/ALL_SYNCED hiển thị điểm cuối đã khóa; settlement tiếp tục ở slice riêng. SL-021 có thể mở rộng cùng route bằng Host-override state/warning, không tạo luồng summary thứ hai.

- [ ] Thực hiện các kịch bản nghiệm thu trực tiếp trong mục 6; thu logs an toàn/device timestamps khi cần.
- [ ] Review kết quả; một branch fail hoặc thiếu required device/emulator evidence thì slice chưa hoàn thành.
- [ ] Commit task sau review nếu execution được phép. Subject dùng `[2026-10-13-sl-020-room-completion]`, trailer `Plan: docs/superpowers/plans/2026-10-13-sl-020-room-completion.md` và `Task: 2`.

## 6. Nghiệm thu và failure outcomes

- [ ] Non-Host complete → deny.
- [ ] Duplicate complete → endedAt và pending count không đổi.
- [ ] Member ACK trước đủ flush → failed-precondition.
- [ ] Duplicate ACK → count giảm một lần.
- [ ] ACK cuối cùng → ALL_SYNCED và FINALIZED.
- [ ] Approved early-exit Member có pre-cutoff event đang chờ lúc Host complete → pending set giữ Member; event giao sau completion vẫn được ghi nhận theo SL-018/D3, rồi ACK qua endedAt finalizes đúng một lần.
- [ ] Early-exit Member không có event sau cutoff vẫn có thể hoàn tất ACK contract qua endedAt; mọi eligible pre-cutoff event phải đã durable trước finalization.
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

TypeScript: `pnpm exec tsc --noEmit`. Rules validation requires the existing Emulator Suite (`pnpm --dir functions run test:emulators`) with Java installed; these checks have not been run. Expo Go interaction, two-device sync and TalkBack/VoiceOver also remain unverified.

**Evidence 2026-10-21:** TypeScript check via the installed local `tsc.cmd` — PASS; `git diff --check` — PASS. Lint — unavailable because ESLint is not configured; Expo attempted automatic dependency installation, which was stopped and left no package or lockfile content change. No Rules Emulator or Expo Go validation has been recorded.

Lệnh app chạy từ `dontlift-mobile/`; file paths tests/backend ở trên là planned targets. Command chỉ được chạy sau harness/dependency prerequisites. Native build/emulator commands phải lấy từ cấu hình thật sau SL-002; không đoán project ID, runtime hoặc production alias. Future schema/index changes được test với approved edition Standard.

Ghi trong kết quả execution: baseline/commit mới, command, exit status, số cases, emulator/device/runtime version, date, actual outcomes và remaining gaps. Các checklist hiện đều chưa chạy.

## 8. Human review và bàn giao P6.2

Human đã duyệt tiếp tục SL-020 trên Firebase free tier ngày 2026-10-21. Quyết định Spark giới hạn theo ADR-017; D3 đã được giải quyết bằng ADR-015. Phạm vi không gồm HOST_OVERRIDE, timeout, bill calculation hoặc paid backend.

Không tự bắt đầu P6.2 từ file draft hoặc từ prompt batch.
