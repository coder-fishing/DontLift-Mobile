# Kế hoạch triển khai P6.1 — SL-024: Nhập bill và tính shares mặc định

> **For agentic workers:** REQUIRED SUB-SKILL: Use the qskill-executing-plans skill to implement this plan task-by-task. Steps use checkbox tracking.
> Kế hoạch chỉ mô tả file, unit, hành vi, quy tắc, đầu ra và test cases; không có implementation code hoặc signatures. Đọc source thật trước mỗi task.
> **Gate:** Chỉ execute khi trạng thái APPROVED FOR EXECUTION và blocker/dependency đã giải quyết.

**Mục tiêu:** Host nhập bill và tính shares mặc định; mọi thành viên xem được breakdown canonical khi Host công bố. Shares không âm, deterministic và tổng bằng total bill.

**Slice:** SL-024. **Ưu tiên đề xuất:** P0. **Release:** MVP + activation/Premium; post-MVP deferred. SL-036 chỉ được tính release sau D6.

**Trạng thái kế hoạch:** APPROVED FOR EXECUTION — human duyệt Spark Host-calculated shares và cách hiểu D9 ngày 2026-10-22. D3 cho SL-018 đã giải quyết trong ADR-015; dependencies SL-020 và SL-023 đã có trên baseline.
**Trạng thái execution:** Implementation SL-024 đã được thêm trên branch `feature/sl-024-default-bill`. Unit/route tests và TypeScript pass; Firestore Rules Emulator và kiểm tra Expo Go còn pending.
**Baseline khảo sát:** docs/p6.0-implementation-slices tại 57ca1eb28a2952c66d01f89b9b89bf755ab4812a.
**Ngày soạn:** 2026-10-13, Asia/Saigon.
**Plan slug:** `2026-10-13-sl-024-default-bill`; mọi commit thực hiện plan này phải bắt đầu `[2026-10-13-sl-024-default-bill]`.
**Đầu vào phạm vi:** Backlog P6.0 v0.1 trong cuộc trò chuyện ngày 2026-10-13, chưa được phê duyệt. User đã yêu cầu ghi draft P6.1 cho cả 37 slice; không suy thành approval thực thi.
**Traceability:** US-13/14; FR-05; API §6.2; ADR-005; V07.
**Phụ thuộc bắt buộc:** [SL-018](./2026-10-13-sl-018-early-exit.md), [SL-020](./2026-10-13-sl-020-room-completion.md), [SL-023](./2026-10-13-sl-023-settlement-details.md)
**Ưu tiên mềm:** Theo thứ tự đề xuất trong [mục lục](../../implementation-plan.md); thứ tự không tạo thêm hard dependency.

## 1. Nguồn và ranh giới

Đọc [PRD](../../product-requirements.md), [Feature Spec](../../feature-specification.md), [Product Design](../../product-design.md), [Design Brief](../../product-design-brief.md), [Architecture](../../software-architecture.md), [API contracts](../../api-contracts.md), ADR áp dụng trong [decisions](../../decisions), cùng AGENTS ở app root. Tham chiếu cụ thể của slice nằm trong Traceability phía trên.

V01–V10 chỉ các màn tương ứng tại `design/concepts/concept-final/screens/`; prototype nằm tại `prototype/`. Chúng là read-only visual/interaction references, không chứng minh integration. Nếu journey không có design screen, trình bày gap với human trước quyết định UI mới.

**Kiến trúc:** Host client tính shares bằng integer arithmetic trên snapshot score đã FINALIZED; một Firestore transaction trên Spark publish toàn bộ kết quả. Rules xác minh Host, room state, document ownership và schema, nhưng không thể chứng minh phép tính hoặc roster đầy đủ. Kết quả đã publish là Host-authoritative, không phải server-verified. Presentation dùng controller/repository, không tính math trong screen.

**Stack:** Expo SDK 57 / React Native / TypeScript / Firebase JS SDK / Firestore Standard trên Spark. Bill calculation/publication là online-only Firestore transaction; không Cloud Functions, Cloud Billing hoặc offline command queue.

**Không gồm:** Overrides, QR, floating-point authority hoặc tự thay rounding pipeline.

## 2. Blocker, risk và quyết định cần duyệt

- **D9 — RESOLVED 2026-10-22:** “Non-zero base share” là positive mathematical base component trước bước round; final integer share có thể bằng 0 khi bill nhỏ/nhiều Members. Không đặt minimum theo Member; giữ ADR-005 exact-sum và non-negative invariants.
- **D3 prerequisite — RESOLVED cho SL-024:** SL-018 và frozen-score cutoff được chốt trong ADR-015; chỉ dùng score đã FINALIZED từ dependency SL-020.
- **Spark authority — RESOLVED 2026-10-22 theo ADR-021:** Host client tính và gửi shares; Rules không xác minh correctness/roster completeness. Giới hạn này phải được giữ trong UI, contract, tests và báo cáo; không mô tả output là server-verified.
- **D8 cho SL-024 — RESOLVED 2026-10-22:** chỉ publish default breakdown một lần. Same-request retry replay receipt; request mới sau publish bị từ chối. Sửa shares đã publish thuộc policy/slice riêng.

**Rủi ro cụ thể:** Theo quyết định D9, base share dương trước rounding nhưng final amount có thể bằng 0 khi bill nhỏ/nhiều Members. Host-calculated authority trên Spark không chứng minh phép tính hoặc tính đầy đủ roster.

Nếu một contract chỉ có responsibility mà chưa có schema, task đầu là trình bày missing decision với nguồn; không tự tạo endpoint/field mới. Các hành vi test bên dưới mô tả outcome cần đạt, không thay thế wire approval. Ngưỡng/range/default chưa được spec xác định phải có quyết định ghi lại trước khi implement.

## 3. File và quyền sở hữu dự kiến

Các đường dẫn sau tương đối với `dontlift-mobile/`. Đọc lại trạng thái file lúc execute để chọn Create/Modify; không ghi đè implementation của dependency.

| File dự kiến | Trách nhiệm |
|---|---|
| `firestore.rules` | Membership-scoped read cho `rooms/{roomId}/billShares/{uid}`; chỉ Host được ghi một lần khi room FINALIZED và settlement details tồn tại; Rules không xác minh phép tính hoặc roster completeness. |
| `functions/tests/bill-shares-rules.emulator.test.cjs` | Client-SDK Emulator Suite tests cho member breakdown reads, outsider/cross-room denial và direct share/payment write denial. SL-025–027 reuse suite/policy. |
| `src/features/settlement/bill-allocation.ts` | Pure integer allocation, deterministic rounding và exact-sum residual distribution. |
| `src/features/settlement/bill-repository.ts` | Host-authenticated online transaction, finalized member-score reads, atomic publication và receipt replay. |
| `src/features/settlement/published-bill-navigation.ts` | Điều kiện chuyển Member tới breakdown khi nhận bill state live. |
| `src/screens/BillAllocationScreen.tsx` | Presentation và states của journey; không chứa domain math/sync authority. |
| `src/features/settlement/published-bill-listener.ts` | Theo dõi bill shares canonical đã công bố để Member nhận cập nhật realtime. |
| `src/screens/GroupSummaryScreen.tsx` | Giữ Member ở summary khi chưa có bill; chuyển sang breakdown khi nhận shares đã công bố. |
| `src/app/index.tsx` | Nối trạng thái room/member với luồng Member từ Group Summary tới Bill Allocation. |
| `src/features/settlement/bill-allocation.ts` | Pure integer calculation for default shares; deterministic residual algorithm and pre-rounding base semantics. |
| `src/features/settlement/bill-repository.ts` | Host-authenticated online transaction, finalized snapshot read, atomic share publication, and receipt replay. |
| `__tests__/default-bill.test.ts` | Kiểm thử allocation và exact-sum invariants. |
| `__tests__/published-bill-navigation.test.ts` | Kiểm chứng Member chờ tại Group Summary, tự chuyển khi Host publish, và chỉ thấy breakdown read-only. |

**Unit:** bill allocation engine và calculateBillShares.
**Nhận:** Host, finalized score snapshot, eligible members và totalBillVnd.
**Trả:** Canonical shares không âm, deterministic và tổng bằng total bill.
**Đầu vào từ dependency:** capabilities/records/commands đã nghiệm thu theo các plan liên kết; chưa có dependency output thì không giả coi integration có thật.
**Đầu ra cho slice sau:** outcome và invariants trong mục tiêu/nghiệm thu dưới đây; tên internal unit là đề xuất, wire names chỉ dùng theo API/ADR đã duyệt.

### Contract dữ liệu đã có

Bảng dưới là trích ranh giới từ API đã duyệt, không tạo schema mới. Spark transaction response không tuyên bố `serverTimeUtcMs`; full required fields/errors/transaction outputs vẫn theo API section được tham chiếu.

| Field | Bắt buộc / hướng | Quy tắc |
|---|---|---|
| version | Bắt buộc | 1, theo common envelope. |
| requestId | Bắt buộc | UUID; cùng actor/payload replay trả prior outcome, payload khác bị collision. |
| roomId | Bắt buộc | UUID, reconciliation FINALIZED và details tồn tại. |
| totalBillVnd | Bắt buộc | Integer từ 1.000; không bắt buộc multiple 1.000. |
| shares | Response | uid and final shareVnd only; base/penalty component values are not separately rounded or stored. |
| calculationVersion / sumShareVnd | Response | Version 1; sum đúng totalBillVnd. |

## 4. Ràng buộc xuyên suốt

- Giữ approved architecture; newer human decisions và accepted ADR exceptions thắng prose cũ.
- Không sao chép Firebase token vào SQLite, AsyncStorage hoặc SecureStore; SDK quản lý session.
- Event offline-capable dùng SQLite domain record và sync_outbox trong một transaction; syncEvents là ingestion authority.
- Command lifecycle/vote/bill/payment không queue để replay muộn. Firestore cache không thay thế outbox.
- Membership authority là rooms/{roomId}/members/{uid}. SL-024 derives actor từ Firebase Auth; Rules giới hạn Host writes nhưng không xác minh math hoặc roster completeness theo ADR-021.
- Giữ 3-Second Grace Period ở cả foreground/background theo ADR-008.
- Local Premium không cấp server quota/capacity; chỉ verified Server Premium cấp server benefits.
- Bill dùng integer VND, deterministic residual và tổng exact theo ADR-005; VietQR non-custodial, không bank polling.
- UI dùng semantic tokens và accepted Liquid Acrylic; loading/empty/error/offline/syncing, labels, safe areas và touch targets được kiểm chứng khi phù hợp.
- Không thêm social login, analytics dashboards, kiosk, wallet, chat, AI coaching hoặc camera-based detection vào MVP.
- Không bật billing, deploy Functions hoặc deploy production Rules; Emulator Suite chỉ kiểm tra contract Spark đã duyệt.

## 5. Các task thực hiện sau approval

### Task 0 — Rules cho bill shares trước client read

**Files:** `firestore.rules`, `functions/tests/bill-shares-rules.emulator.test.cjs`. Reuse room membership Rules SL-016 và Emulator Suite harness SL-002/003.

- [ ] Members cùng room được đọc share breakdown/status theo đúng query/listener; anonymous, outsider và cross-room members bị deny bằng client SDK.
- [ ] Deny member/outsider create/update/delete shares, calculation metadata and payment status. Allow only the authenticated Host transaction for a FINALIZED room with settlement details; explicitly document that Rules do not verify the complete calculation or roster.
- [ ] Kiểm chứng query thực tế cho whole-room breakdown không vượt room membership; giữ `billShares/{uid}` làm path từ Feature Spec.
- [ ] Chạy lại root room/member Rules regression; SL-025–027 tái dùng policy/tests, không tạo quyền song song; SL-037 re-test canonical policy.

### Task 1 — Boundary và quy tắc của Nhập bill và tính shares mặc định

**Files:** Dùng units/config/backend/repositories trong bảng mục 3; khi test source đã được chỉ định, đặt cases thuộc boundary vào đúng app/backend target. Không thay presentation chưa cần cho task này.

**Nhận/trả:** Nhận Host, finalized score snapshot, eligible members và totalBillVnd; trả Canonical shares không âm, deterministic và tổng bằng total bill. Với contract đang bị chặn, chưa có quyền thêm schema dù test outcome đã được nêu.

- [ ] Đọc lại source/spec và xác nhận tất cả blocker cùng dependency cho task đã được giải quyết; nếu chưa, dừng execution và báo đúng blocker.
- [ ] Viết focused failing cases sau đây; runner không tìm thấy hoặc thiếu dependency không được tính là red nghiệp vụ.

- [ ] Tổng điểm bằng không → chia toàn bill, exact sum.
- [ ] Bill 1.001 VND → valid, exact residual.
- [ ] Negative/float/dưới 1.000 → reject.

- [ ] Chạy focused command trong mục 7; xác nhận failure đúng behavior đang thiếu, không từ toolchain lỗi.
- [ ] Xây hành vi theo thứ tự sau, chỉ sau approval:

1. Chặn khi chưa FINALIZED hoặc thiếu settlement details; chỉ Host submit integer từ 1.000 VND qua online transaction.
2. Zero total penalty chia đều full bill; còn lại 40/60 bằng integer basis points, include early-exit frozen score. Build base components as positive pre-round values; final values follow non-negative rounding and residual rules and may be zero.
3. Round half-up tới 1.000, distribute residual theo rank và UID; sub-1.000 remainder tới eligible member, tối đa một share không multiple 1.000.

- [ ] Chạy lại các cases và đối chiếu output/invariants; không tuyên bố native/integration PASS từ mock.
- [ ] Review task và commit chỉ files thuộc task nếu execution được phép. Subject dùng `[2026-10-13-sl-024-default-bill]`, trailer `Plan: docs/superpowers/plans/2026-10-13-sl-024-default-bill.md` và `Task: 1`.

### Task 2 — Journey tích hợp và recovery

**Files:** Presentation/adapter/evidence trong mục 3 cùng boundary task 1; không refactor screen không liên quan. Task này không tạo implementation thứ hai cho unit task 1.

**Nhận:** Output task 1 đã kiểm chứng. **Trả:** Journey/bằng chứng có thể nghiệm thu; error/offline không false-success.

- [ ] Viết các failing cases về integration/recovery sau; không viết tests chỉ mirror implementation.

- [ ] Early-exit Member → dùng frozen score.
- [ ] Same request replay → stable same shares; a different request after publish is rejected.
- [ ] Nhiều random valid inputs → shares integer/non-negative/exact-sum/tie deterministic.
- [ ] Member reads bill shares trong room → allowed; outsider/cross-room → denied; mọi direct client share/payment write → denied trên Emulator Suite.
- [ ] Member ở Group Summary trước khi publish → vẫn ở summary, thấy trạng thái bill chưa được Host công bố.
- [ ] Host công bố canonical shares → Member đang ở Group Summary được chuyển tới breakdown read-only và thấy đúng shares mới nhất.
- [ ] Bill listener lỗi hoặc offline trước khi có snapshot mới → không điều hướng như thể bill đã công bố; hiển thị trạng thái chờ/lỗi phù hợp và giữ khả năng thử lại.
- [ ] Member mở breakdown → không thấy hoặc dùng được thao tác nhập bill, tính lại, override hay publish dành riêng cho Host.

- [ ] Chạy focused checks, xác nhận failure đúng behavior; giữ fixtures tách khỏi device evidence.
- [ ] Tích hợp theo thứ tự:

1. Atomically replace shares/room total/calculationVersion/receipt from the Host transaction. A local preview is not shown as published before server-confirmed commit. Rules authorize Host and room state but do not validate the math.
2. Host tiếp tục nhập và công bố bill theo quyền hiện có. Member ở Group Summary chờ snapshot bill shares đã công bố; khi snapshot tới, điều hướng tới Bill Allocation ở chế độ chỉ xem.
3. Bill Allocation phân biệt Host và Member: chỉ Host có controls nhập/tính/publish; Member chỉ đọc breakdown canonical. Không dùng cache cũ để tạo hoặc khẳng định một lần publish mới.
4. Giữ trạng thái loading, chưa publish, cached/offline và error rõ ràng; lỗi listener không được điều hướng giả hoặc che nút retry.
5. Property tests covers small bills/many members/zero penalty; nonzero-share wording không được dùng để invent impossible minima.

- [ ] Thực hiện các kịch bản nghiệm thu trực tiếp trong mục 6; thu logs an toàn/device timestamps khi cần.
- [ ] Review kết quả; một branch fail hoặc thiếu required device/emulator evidence thì slice chưa hoàn thành.
- [ ] Commit task sau review nếu execution được phép. Subject dùng `[2026-10-13-sl-024-default-bill]`, trailer `Plan: docs/superpowers/plans/2026-10-13-sl-024-default-bill.md` và `Task: 2`.

## 6. Nghiệm thu và failure outcomes

- [ ] Tổng điểm bằng không → chia toàn bill, exact sum.
- [ ] Bill 1.001 VND → valid, exact residual.
- [ ] Negative/float/dưới 1.000 → reject.
- [ ] Early-exit Member → dùng frozen score.
- [ ] Repeated calculation request → stable same shares.
- [ ] Nhiều random valid inputs → shares integer/non-negative/exact-sum/tie deterministic.
- [ ] Host nhập bill thực, Member thấy canonical breakdown.
- [ ] Member ở Group Summary nhận publish realtime và chuyển tới breakdown read-only; trước publish vẫn ở summary.
- [ ] Member không thể nhập bill, override, tính lại hoặc publish từ breakdown.
- [ ] Unauthorized direct share write → deny; client score sửa không thay server snapshot.

Mỗi case phải có actual result. Unit cases dùng controlled fixtures để chứng minh domain; Firebase boundary cần Rules Emulator tests cho allowed/denied/replay/concurrency. Sensor/lifecycle cần physical devices. Không có evidence thì ghi UNVERIFIED và blocker, không tick PASS. Rules tests must not be represented as proof that Host math or roster completeness is correct.

**Failure recovery bắt buộc:** không hiển thị successful save/transition khi commit/request chưa thành công; giữ dữ liệu/retry context theo hành vi cụ thể trong tasks. Không log email đầy đủ, token, activation code hoặc bank details. Case không áp dụng cho slice phải ghi lý do trong evidence, không bỏ im lặng.

## 7. Verification và ghi nhận evidence

App focused tests: `node node_modules/jest/bin/jest.js --runInBand --runTestsByPath __tests__/default-bill.test.ts __tests__/published-bill-navigation.test.ts`. Rules Suite: `node --test functions/tests/bill-shares-rules.emulator.test.cjs` with Firestore Emulator running. TypeScript: `node node_modules/typescript/bin/tsc --noEmit`. Lint: `pnpm run lint` chỉ khi repository có ESLint setup thực tế.

Lệnh app chạy từ `dontlift-mobile/`; file paths tests/backend ở trên là planned targets. Command chỉ được chạy sau harness/dependency prerequisites. Native build/emulator commands phải lấy từ cấu hình thật sau SL-002; không đoán project ID, runtime hoặc production alias. Future schema/index changes được test với approved edition Standard.

Ghi trong kết quả execution: baseline/commit mới, command, exit status, số cases, emulator/device/runtime version, date, actual outcomes và remaining gaps.

### Execution evidence — 2026-10-22

| Check | Result | Evidence / remaining work |
|---|---|---|
| TypeScript | PASS | `node node_modules/typescript/bin/tsc --noEmit` từ `dontlift-mobile/`; exit 0. |
| Allocation + navigation tests | PASS | Jest focused command phía trên; 2 suites, 14 tests; exit 0. |
| Lint | FAIL | `pnpm run lint` ngày 2026-10-22; exit 1, 30 errors và 20 warnings với Expo default config. Repo chưa có ESLint config; file được Expo tự sinh trong lần kiểm tra đã được loại bỏ để không đưa cấu hình lint mới vào SL-024. |
| `git diff --check` | PASS | Chạy lại sau khi loại dòng trống thừa ở cuối `src/types.ts`; exit 0. |
| Firestore Rules Emulator | BLOCKED | Chưa có `FIRESTORE_EMULATOR_HOST`; `java -version` không chạy được do Java chưa cài/không có trên PATH. Không triển khai production Rules. |
| Expo Go / Host-Member realtime | UNVERIFIED | Cần chạy app trên thiết bị và hai tài khoản để xác nhận UI, publish, member listener và retry. |
| Billing / Functions / production deployment | NOT USED | Giữ Spark; không bật billing, deploy Functions hoặc production Rules. |

## 8. Human review và bàn giao P6.2

Human approved SL-024 scope and Spark Host-calculated authority on 2026-10-22; D8/D9 semantics are also resolved on that date. This approval does not authorize billing, Functions deployment, production Rules deployment, overrides, or any other slice.

Approval evidence and resolved decisions are recorded above. Execution is authorized on the re-inspected `feature/sl-024-default-bill` baseline. On 2026-10-22 the user additionally authorized splitting the current changes into multiple commits, pushing the branch, and creating a PR. Production Rules deployment, billing, and Functions deployment remain outside this authorization.
