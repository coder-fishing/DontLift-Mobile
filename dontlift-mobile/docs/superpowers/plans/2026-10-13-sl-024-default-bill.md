# Kế hoạch triển khai P6.1 — SL-024: Nhập bill và tính shares mặc định

> **For agentic workers:** REQUIRED SUB-SKILL: Use the qskill-executing-plans skill to implement this plan task-by-task. Steps use checkbox tracking.
> Kế hoạch chỉ mô tả file, unit, hành vi, quy tắc, đầu ra và test cases; không có implementation code hoặc signatures. Đọc source thật trước mỗi task.
> **Gate:** Không execute kế hoạch khi trạng thái còn DRAFT hoặc khi blocker/dependency chưa giải quyết. Việc tạo file này không phê duyệt backlog hay P6.2.

**Mục tiêu:** Host nhập bill và tính shares mặc định; mọi thành viên xem được breakdown canonical khi Host công bố. Shares không âm, deterministic và tổng bằng total bill.

**Slice:** SL-024. **Ưu tiên đề xuất:** P0. **Release:** MVP + activation/Premium; post-MVP deferred. SL-036 chỉ được tính release sau D6.

**Trạng thái kế hoạch:** DRAFT — chưa được human duyệt; bị chặn bởi D3 qua prerequisite SL-018 và bởi D9.
**Trạng thái implementation quan sát:** Client math float, không exact-sum guarantee. Chưa có evidence nghiệm thu slice.
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

**Kiến trúc:** bill allocation engine và calculateBillShares sở hữu hành vi của slice. Presentation đọc kết quả qua controller/repository; không tự trở thành nguồn authoritative. Units và đường dẫn mới bên dưới là đề xuất, chưa tồn tại trên baseline; nếu prerequisite đã tạo cùng trách nhiệm thì reuse, không thêm convention thứ hai.

**Stack:** Expo SDK 57 / React Native / TypeScript. SQLite cho local-first khi slice có persistence; React Native Firebase Auth/Firestore Standard/Functions cho boundary có Firebase. Không bắt slice thuần local phải có network.

**Không gồm:** Overrides, QR, floating-point authority hoặc tự thay rounding pipeline.

## 2. Blocker, risk và quyết định cần duyệt

- **D9:** Giải quyết wording non-zero base share khi bill nhỏ/nhiều Members đối nghịch integer/non-negative/exact-sum. Giữ invariant ADR-005; không tự tạo minimum bill per member.
- **D3 prerequisite:** SL-018 phải chốt và nghiệm thu contract early-exit/frozen score trước khi SL-024 dùng frozen score trong tính toán hoặc acceptance.

**Rủi ro cụ thể:** PRD nonzero base share có edge case bill nhỏ/nhiều Members; human clarify trước chấp nhận contradictory invariant.

Nếu một contract chỉ có responsibility mà chưa có schema, task đầu là trình bày missing decision với nguồn; không tự tạo endpoint/field mới. Các hành vi test bên dưới mô tả outcome cần đạt, không thay thế wire approval. Ngưỡng/range/default chưa được spec xác định phải có quyết định ghi lại trước khi implement.

## 3. File và quyền sở hữu dự kiến

Các đường dẫn sau tương đối với `dontlift-mobile/`. Đọc lại trạng thái file lúc execute để chọn Create/Modify; không ghi đè implementation của dependency.

| File dự kiến | Trách nhiệm |
|---|---|
| `firestore.emulator.rules` | SL-024 mở membership-scoped read cho `rooms/{roomId}/billShares/{uid}`; chỉ bill calculation callable/server được ghi shares. |
| `functions/tests/bill-shares-rules.emulator.test.cjs` | Client-SDK Emulator Suite tests cho member breakdown reads, outsider/cross-room denial và direct share/payment write denial. SL-025–027 reuse suite/policy. |
| `src/features/settlement/bill-controller.ts` | Unit/repository/adapter chuyên trách; reuse nếu prerequisite đã tạo. |
| `src/screens/BillAllocationScreen.tsx` | Presentation và states của journey; không chứa domain math/sync authority. |
| `src/features/settlement/published-bill-listener.ts` | Theo dõi bill shares canonical đã công bố để Member nhận cập nhật realtime. |
| `src/screens/GroupSummaryScreen.tsx` | Giữ Member ở summary khi chưa có bill; chuyển sang breakdown khi nhận shares đã công bố. |
| `src/app/index.tsx` | Nối trạng thái room/member với luồng Member từ Group Summary tới Bill Allocation. |
| `functions/src/bill-allocation.cjs` | Backend boundary của slice; server identity/validation/transaction. |
| `functions/src/calculate-bill-shares.cjs` | Backend boundary của slice; server identity/validation/transaction. |
| `functions/index.js` | Backend boundary của slice; server identity/validation/transaction. |
| `__tests__/default-bill.test.ts` | Kiểm thử dự kiến; chưa tạo test source trong P6.1. |
| `__tests__/published-bill-navigation.test.ts` | Kiểm chứng Member chờ tại Group Summary, tự chuyển khi Host publish, và chỉ thấy breakdown read-only. |
| `functions/tests/default-bill.test.cjs` | Kiểm thử dự kiến; chưa tạo test source trong P6.1. |

**Unit:** bill allocation engine và calculateBillShares.
**Nhận:** Host, finalized score snapshot, eligible members và totalBillVnd.
**Trả:** Canonical shares không âm, deterministic và tổng bằng total bill.
**Đầu vào từ dependency:** capabilities/records/commands đã nghiệm thu theo các plan liên kết; chưa có dependency output thì không giả coi integration có thật.
**Đầu ra cho slice sau:** outcome và invariants trong mục tiêu/nghiệm thu dưới đây; tên internal unit là đề xuất, wire names chỉ dùng theo API/ADR đã duyệt.

### Contract dữ liệu đã có

Bảng dưới là trích ranh giới từ API đã duyệt, không tạo schema mới. Common response giữ version/requestId/serverTimeUtcMs khi contract yêu cầu; full required fields/errors/transaction outputs vẫn theo API section được tham chiếu.

| Field | Bắt buộc / hướng | Quy tắc |
|---|---|---|
| version | Bắt buộc | 1, theo common envelope. |
| requestId | Bắt buộc | UUID; cùng actor/payload replay trả prior outcome, payload khác bị collision. |
| roomId | Bắt buộc | UUID, reconciliation FINALIZED và details tồn tại. |
| totalBillVnd | Bắt buộc | Integer từ 1.000; không bắt buộc multiple 1.000. |
| shares | Response | uid, baseShareVnd, penaltyShareVnd, shareVnd. |
| calculationVersion / sumShareVnd | Response | Version 1; sum đúng totalBillVnd. |

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

### Task 0 — Rules cho bill shares trước client read

**Files:** `firestore.emulator.rules`, `functions/tests/bill-shares-rules.emulator.test.cjs`. Reuse room membership Rules SL-016 và Emulator Suite harness SL-002/003.

- [ ] Members cùng room được đọc share breakdown/status theo đúng query/listener; anonymous, outsider và cross-room members bị deny bằng client SDK.
- [ ] Deny direct client create/update/delete bill shares, calculation version, override metadata và payment status; authoritative writes chỉ qua approved callables.
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

1. Chặn khi chưa FINALIZED hoặc thiếu settlement details; chỉ Host submit integer từ 1.000 VND.
2. Zero total penalty chia đều full bill; còn lại 40/60 bằng integer basis points, include early-exit frozen score.
3. Round half-up tới 1.000, distribute residual theo rank và UID; sub-1.000 remainder tới eligible member, tối đa một share không multiple 1.000.

- [ ] Chạy lại các cases và đối chiếu output/invariants; không tuyên bố native/integration PASS từ mock.
- [ ] Review task và commit chỉ files thuộc task nếu execution được phép. Subject dùng `[2026-10-13-sl-024-default-bill]`, trailer `Plan: docs/superpowers/plans/2026-10-13-sl-024-default-bill.md` và `Task: 1`.

### Task 2 — Journey tích hợp và recovery

**Files:** Presentation/adapter/evidence trong mục 3 cùng boundary task 1; không refactor screen không liên quan. Task này không tạo implementation thứ hai cho unit task 1.

**Nhận:** Output task 1 đã kiểm chứng. **Trả:** Journey/bằng chứng có thể nghiệm thu; error/offline không false-success.

- [ ] Viết các failing cases về integration/recovery sau; không viết tests chỉ mirror implementation.

- [ ] Early-exit Member → dùng frozen score.
- [ ] Repeated calculation request → stable same shares.
- [ ] Nhiều random valid inputs → shares integer/non-negative/exact-sum/tie deterministic.
- [ ] Member reads bill shares trong room → allowed; outsider/cross-room → denied; mọi direct client share/payment write → denied trên Emulator Suite.
- [ ] Member ở Group Summary trước khi publish → vẫn ở summary, thấy trạng thái bill chưa được Host công bố.
- [ ] Host công bố canonical shares → Member đang ở Group Summary được chuyển tới breakdown read-only và thấy đúng shares mới nhất.
- [ ] Bill listener lỗi hoặc offline trước khi có snapshot mới → không điều hướng như thể bill đã công bố; hiển thị trạng thái chờ/lỗi phù hợp và giữ khả năng thử lại.
- [ ] Member mở breakdown → không thấy hoặc dùng được thao tác nhập bill, tính lại, override hay publish dành riêng cho Host.

- [ ] Chạy focused checks, xác nhận failure đúng behavior; giữ fixtures tách khỏi device evidence.
- [ ] Tích hợp theo thứ tự:

1. Atomically replace shares/room total/calculationVersion/receipt; client chỉ preview hoặc canonical read.
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

Mỗi case phải có actual result. Unit cases dùng controlled fixtures để chứng minh domain; Firebase boundary cần Rules/Functions emulator tests cho allowed/denied/replay/concurrency khi áp dụng. Sensor/lifecycle cần physical devices. Không có evidence thì ghi UNVERIFIED và blocker, không tick PASS.

**Failure recovery bắt buộc:** không hiển thị successful save/transition khi commit/request chưa thành công; giữ dữ liệu/retry context theo hành vi cụ thể trong tasks. Không log email đầy đủ, token, activation code hoặc bank details. Case không áp dụng cho slice phải ghi lý do trong evidence, không bỏ im lặng.

## 7. Verification và ghi nhận evidence

App focused tests sau khi SL-001 cấu hình runner: `pnpm test --runTestsByPath __tests__/default-bill.test.ts`. Backend focused tests sau backend bootstrap SL-003 và native/emulator prerequisites SL-002: `node --test functions/tests/default-bill.test.cjs`; Rules Suite: `node --test functions/tests/bill-shares-rules.emulator.test.cjs`. TypeScript: `pnpm exec tsc --noEmit`. Lint: `pnpm run lint` chỉ khi repository có ESLint setup thực tế.

Lệnh app chạy từ `dontlift-mobile/`; file paths tests/backend ở trên là planned targets. Command chỉ được chạy sau harness/dependency prerequisites. Native build/emulator commands phải lấy từ cấu hình thật sau SL-002; không đoán project ID, runtime hoặc production alias. Future schema/index changes được test với approved edition Standard.

Ghi trong kết quả execution: baseline/commit mới, command, exit status, số cases, emulator/device/runtime version, date, actual outcomes và remaining gaps. Các checklist hiện đều chưa chạy.

## 8. Human review và bàn giao P6.2

Human phải duyệt scope, non-goals, tasks, acceptance cases, dependencies và các quyết định còn mở của **SL-024** trước implementation. Duyệt một slice không duyệt tất cả 37; duyệt authoring batch không duyệt code.

Sau approval, cập nhật trạng thái/date/decision evidence trong đúng plan; kế hoạch mới chỉ đủ execution-ready khi blocker đã được giải quyết và baseline được re-inspect. Dùng qskill-executing-plans khi user yêu cầu execute plan đã duyệt. Không tự bắt đầu P6.2 từ file draft hoặc từ prompt batch.
