# Kế hoạch triển khai P6.1 — SL-016: Lobby realtime và Host bắt đầu

> **For agentic workers:** REQUIRED SUB-SKILL: Use the qskill-executing-plans skill to implement this plan task-by-task. Steps use checkbox tracking.
> Kế hoạch chỉ mô tả file, unit, hành vi, quy tắc, đầu ra và test cases; không có implementation code hoặc signatures. Đọc source thật trước mỗi task.
> **Gate:** Không execute kế hoạch khi trạng thái còn DRAFT hoặc khi blocker/dependency chưa giải quyết. Việc tạo file này không phê duyệt backlog hay P6.2.

**Mục tiêu:** Lobby realtime và Host bắt đầu: Roster projected, Host-only start và WAITING sang ACTIVE canonical.

**Slice:** SL-016. **Ưu tiên đề xuất:** P0. **Release:** MVP + activation/Premium; post-MVP deferred. SL-036 chỉ được tính release sau D6.

**Trạng thái kế hoạch:** APPROVED FOR EXECUTION — human approved SL-016 and the Spark `startRoom` exception on 2026-10-20; startRoom D3 scope resolved by ADR-013. Other D3 decisions remain blockers for their owning slices.
**Trạng thái implementation quan sát:** Đã bổ sung client transaction, Rules và listener trong lượt thực thi; cần ghi evidence sau khi chạy kiểm tra. Hai thiết bị Expo Go chưa được kiểm chứng.
**Baseline khảo sát:** docs/p6.0-implementation-slices tại 57ca1eb28a2952c66d01f89b9b89bf755ab4812a.
**Ngày soạn:** 2026-10-13, Asia/Saigon.
**Plan slug:** `2026-10-13-sl-016-room-lobby-start`; mọi commit thực hiện plan này phải bắt đầu `[2026-10-13-sl-016-room-lobby-start]`.
**Đầu vào phạm vi:** Backlog P6.0 v0.1 trong cuộc trò chuyện ngày 2026-10-13, chưa được phê duyệt. User đã yêu cầu ghi draft P6.1 cho cả 37 slice; không suy thành approval thực thi.
**Traceability:** US-08; ARCH §7; ADR-004; ADR-013; API Contract §3; V05.
**Phụ thuộc bắt buộc:** [SL-014](./2026-10-13-sl-014-room-join-pin.md)
**Ưu tiên mềm:** Theo thứ tự đề xuất trong [mục lục](../../implementation-plan.md); thứ tự không tạo thêm hard dependency.

## 1. Nguồn và ranh giới

Đọc [PRD](../../product-requirements.md), [Feature Spec](../../feature-specification.md), [Product Design](../../product-design.md), [Design Brief](../../product-design-brief.md), [Architecture](../../software-architecture.md), [API contracts](../../api-contracts.md), ADR áp dụng trong [decisions](../../decisions), cùng AGENTS ở app root. Tham chiếu cụ thể của slice nằm trong Traceability phía trên.

V01–V10 chỉ các màn tương ứng tại `design/concepts/concept-final/screens/`; prototype nằm tại `prototype/`. Chúng là read-only visual/interaction references, không chứng minh integration. Nếu journey không có design screen, trình bày gap với human trước quyết định UI mới.

**Kiến trúc:** room listener và startRoom sở hữu hành vi của slice. Presentation đọc kết quả qua controller/repository; không tự trở thành nguồn authoritative. Units và đường dẫn mới bên dưới là đề xuất, chưa tồn tại trên baseline; nếu prerequisite đã tạo cùng trách nhiệm thì reuse, không thêm convention thứ hai.

**Stack:** Expo SDK 57 / React Native / TypeScript; Firebase JS Auth/Firestore Standard. Room listeners and `startRoom` use the Rules-authorized client transaction in ADR-013; no Functions deployment.

**Không gồm:** Active tracking, invented lobby-leave contract hoặc local role authority.

## 2. Blocker, risk và quyết định cần duyệt

- **D3:** Resolved for this slice's `startRoom` wire/schema/error/concurrency by ADR-013 and API Contract §3 on 2026-10-20. D3 remains open for early-exit, vote, heartbeat and long-running violation sync in their owning slices; SL-016 does not use those contracts.

**Rủi ro cụ thể:** concurrent start/replay, stale listener callbacks when switching rooms, and read usage for large Premium rosters.

Nếu một contract chỉ có responsibility mà chưa có schema, task đầu là trình bày missing decision với nguồn; không tự tạo endpoint/field mới. Các hành vi test bên dưới mô tả outcome cần đạt, không thay thế wire approval. Ngưỡng/range/default chưa được spec xác định phải có quyết định ghi lại trước khi implement.

## 3. File và quyền sở hữu dự kiến

Các đường dẫn sau tương đối với `dontlift-mobile/`. Đọc lại trạng thái file lúc execute để chọn Create/Modify; không ghi đè implementation của dependency.

| File dự kiến | Trách nhiệm |
|---|---|
| `firestore.rules` | Extend the existing deny-by-default source with member roster reads and the exact `startRoom` update; do not deploy it in this slice. |
| `functions/tests/room-lobby-start.rules.emulator.test.cjs` | Client-SDK Rules cases for member room/roster reads, outsider/cross-room denial, exact Host start allow, and every other room/member authoritative mutation denied. |
| `src/features/rooms/room-listener.ts` | Unit/repository/adapter chuyên trách; reuse nếu prerequisite đã tạo. |
| `src/features/rooms/room-repository.ts` | Unit/repository/adapter chuyên trách; reuse nếu prerequisite đã tạo. |
| `src/screens/GroupLobbyScreen.tsx` | Presentation và states của journey; không chứa domain math/sync authority. |
| `__tests__/room-lobby-start.test.ts` | Repository start transaction, idempotency and Host authority cases. |

**Unit:** room listener và startRoom.
**Nhận:** Room membership và authoritative room/members snapshots.
**Trả:** Roster projected, Host-only start và WAITING sang ACTIVE canonical.
**Đầu vào từ dependency:** capabilities/records/commands đã nghiệm thu theo các plan liên kết; chưa có dependency output thì không giả coi integration có thật.
**Đầu ra cho slice sau:** outcome và invariants trong mục tiêu/nghiệm thu dưới đây; tên internal unit là đề xuất, wire names chỉ dùng theo API/ADR đã duyệt.

## 4. Ràng buộc xuyên suốt

- Giữ approved architecture; newer human decisions và accepted ADR exceptions thắng prose cũ.
- Không sao chép Firebase token vào SQLite, AsyncStorage hoặc SecureStore; SDK quản lý session.
- Event offline-capable dùng SQLite domain record và sync_outbox trong một transaction; syncEvents là ingestion authority.
- Command lifecycle/vote/bill/payment không queue để replay muộn. Firestore cache không thay thế outbox.
- Membership authority là rooms/{roomId}/members/{uid}. SL-016 derives actor from Firebase Auth and Firestore Rules enforce the Host transaction; Admin SDK bypass Rules.
- Giữ 3-Second Grace Period ở cả foreground/background theo ADR-008.
- Local Premium không cấp server quota/capacity; chỉ verified Server Premium cấp server benefits.
- Bill dùng integer VND, deterministic residual và tổng exact theo ADR-005; VietQR non-custodial, không bank polling.
- UI dùng semantic tokens và accepted Liquid Acrylic; loading/empty/error/offline/syncing, labels, safe areas và touch targets được kiểm chứng khi phù hợp.
- Không thêm social login, analytics dashboards, kiosk, wallet, chat, AI coaching hoặc camera-based detection vào MVP.
- Không bật billing, deploy Functions hoặc deploy Rules trong SL-016; verification chỉ dùng local Emulator Suite và app checks.

## 5. Các task thực hiện sau approval

### Task 0 — Rules room/member trước listener

**Files:** firestore.rules, functions/tests/room-lobby-start.rules.emulator.test.cjs. **Dependency output:** Existing Emulator Suite config and client-SDK test harness from SL-002/003; no production Rules deployment.

- [ ] Đọc ADR-004 và query shape room/members thực tế; không dùng participantIds hoặc role từ request làm authority.
- [ ] Viết Rules cases bằng client SDK: Host/Member có membership đọc room/member roster; anonymous, outsider không có đúng PIN và user room A đọc room B bị deny.
- [ ] Deny mọi client create/update/delete authoritative trên membership; room update chỉ được phép là join transaction hiện có hoặc chính xác Host `WAITING → ACTIVE` theo ADR-013.
- [ ] Viết mutation cases: client không tạo/sửa/xóa membership/role, room lifecycle, score/counters; PIN/usage/activation/receipt collections không cho client đọc/ghi.
- [ ] Mở đúng allowlisted room/member read paths; giữ existing owner-history/profile Rules từ các slice trước và default deny ở paths còn lại.
- [ ] Kiểm chứng query/listener thật và deny cases bằng Firebase client SDK trên Emulator Suite. Admin seeding chỉ dựng fixtures, không dùng Admin SDK để chứng minh Rules đã pass.
- [ ] Chạy regression resource Rules đã có; thiếu emulator host/process thì báo blocker/fail, không skip thành PASS.
- [ ] Listener integration Task 1/2 chỉ nghiệm thu sau Rules cases pass. Không thêm dependency sang profile editing SL-029.
- [ ] Không deploy Rules; SL-037 owns production promotion and re-verifies the tested source against deployment config after D1/E2.

### Task 1 — Boundary và quy tắc của Lobby realtime và Host bắt đầu

**Files:** Dùng units/config/backend/repositories trong bảng mục 3; khi test source đã được chỉ định, đặt cases thuộc boundary vào đúng app/backend target. Không thay presentation chưa cần cho task này.

**Nhận/trả:** Nhận Room membership và authoritative room/members snapshots; trả Roster projected, Host-only start và WAITING sang ACTIVE canonical theo contract đã duyệt.

- [ ] Đọc lại source/spec và xác nhận tất cả blocker cùng dependency cho task đã được giải quyết; nếu chưa, dừng execution và báo đúng blocker.
- [ ] Viết focused failing cases sau đây; runner không tìm thấy hoặc thiếu dependency không được tính là red nghiệp vụ.

- [ ] Member create/join → roster projection đúng; membership projection only changes from canonical snapshots.
- [ ] Member gọi start → permission-denied.
- [ ] Start room đã ACTIVE → contract-defined safe outcome.

- [ ] Chạy focused command trong mục 7; xác nhận failure đúng behavior đang thiếu, không từ toolchain lỗi.
- [ ] Xây hành vi theo thứ tự sau, chỉ sau approval:

1. Implement the approved ADR-013/API Contract §3 startRoom transaction. Lobby exit only unsubscribes; it does not mutate membership or room lifecycle.
2. Listen to room/members theo authorized query; project canonical snapshots to the lobby screen.
3. Host-only start checks WAITING and commits the exact transition atomically; same request ID replays, other IDs cannot start twice; Member request is denied.

- [ ] Chạy lại các cases và đối chiếu output/invariants; không tuyên bố native/integration PASS từ mock.
- [ ] Review task và commit chỉ files thuộc task nếu execution được phép. Subject dùng `[2026-10-13-sl-016-room-lobby-start]`, trailer `Plan: docs/superpowers/plans/2026-10-13-sl-016-room-lobby-start.md` và `Task: 1`.

### Task 2 — Journey tích hợp và recovery

**Files:** Presentation/adapter/evidence trong mục 3 cùng boundary task 1; không refactor screen không liên quan. Task này không tạo implementation thứ hai cho unit task 1.

**Nhận:** Output task 1 đã kiểm chứng. **Trả:** Journey/bằng chứng có thể nghiệm thu; error/offline không false-success.

- [ ] Viết các failing cases về integration/recovery sau; không viết tests chỉ mirror implementation.

- [ ] Duplicate start request → một transition.
- [ ] Reconnect → không nhân đôi subscriptions/roster.
- [ ] Snapshot cũ room A → không áp sang room B.

- [ ] Chạy focused checks, xác nhận failure đúng behavior; giữ fixtures tách khỏi device evidence.
- [ ] Tích hợp theo thứ tự:

1. Host thấy Start; Member chỉ waiting, không render hidden privilege controls.
2. Loading/error states giữ snapshot gần nhất khi listener lỗi và không tuyên bố snapshot đó là mới.
3. Screen exit, room switch, and logout unsubscribe; callbacks from an old room never update the new room. Lobby exit does not mutate server membership.

- [ ] Thực hiện các kịch bản nghiệm thu trực tiếp trong mục 6; thu logs an toàn/device timestamps khi cần.
- [ ] Review kết quả; một branch fail hoặc thiếu required device/emulator evidence thì slice chưa hoàn thành.
- [ ] Commit task sau review nếu execution được phép. Subject dùng `[2026-10-13-sl-016-room-lobby-start]`, trailer `Plan: docs/superpowers/plans/2026-10-13-sl-016-room-lobby-start.md` và `Task: 2`.

### Acceptance Rules bắt buộc

- [ ] Host/Member với membership thật → đọc được own room và roster query đúng shape.
- [ ] Anonymous/authenticated outsider without the exact PIN/cross-room user → read/listener is denied; authorized join lookup remains limited to SL-014's exact PIN path.
- [ ] Client create/update/delete of membership, role, score or counters is denied; room updates outside the exact Host start allowlist are denied.
- [ ] Client đọc/ghi PIN reservations, usage, activation và receipts → bị deny.
- [ ] Emulator client tests cùng regression Rules pass trước claim lobby realtime ready.
- [ ] Rules enforce Auth/Host membership/lifecycle for the Spark transaction; no startRoom Function is deployed or required.

## 6. Nghiệm thu và failure outcomes

- [ ] Member join → roster projection đúng; roster fields/status reflect canonical snapshots.
- [ ] Member gọi start → permission-denied.
- [ ] Start room đã ACTIVE → contract-defined safe outcome.
- [ ] Duplicate start request → một transition.
- [ ] Reconnect → không nhân đôi subscriptions/roster.
- [ ] Snapshot cũ room A → không áp sang room B.
- [ ] Hai devices lobby → roster cập nhật thật và Host start tới cả hai.
- [ ] Offline Host bấm Start → không queued lifecycle command.

Mỗi case phải có actual result. Firebase boundary dùng Rules Emulator tests cho allowed/denied/replay; physical Expo Go trên hai thiết bị là bằng chứng riêng. Không có evidence thì ghi UNVERIFIED và blocker, không tick PASS.

**Failure recovery bắt buộc:** không hiển thị successful save/transition khi commit/request chưa thành công; giữ dữ liệu/retry context theo hành vi cụ thể trong tasks. Không log email đầy đủ, token, activation code hoặc bank details. Case không áp dụng cho slice phải ghi lý do trong evidence, không bỏ im lặng.

## 7. Verification và ghi nhận evidence

Rules focused command in the configured local Emulator Suite: `firebase emulators:exec --config ../firebase.emulator.json --project demo-dontlift-expo-go --only firestore "node --test tests/room-lobby-start.rules.emulator.test.cjs"` (run from `functions/`). It must fail fast when the local emulator is unavailable and must use client SDK contexts for assertions.

App checks: `pnpm exec tsc --noEmit` and the focused Jest suites for room create/join. There is no Cloud Functions boundary for `startRoom`. TypeScript: `pnpm exec tsc --noEmit`. Regression Rules suites: `pnpm run test:emulators`. Lint: `pnpm run lint` only if the repository has ESLint setup.

App tests run from `dontlift-mobile/`; Rules tests run from `dontlift-mobile/functions/`. The checked-in `firebase.emulator.json` selects `firestore.rules` and the demo project ID; never deploy from these checks. The architecture targets Firestore Standard. No production project ID or alias is inferred.

Ghi trong kết quả execution: baseline/commit mới, command, exit status, số cases, emulator/device/runtime version, date, actual outcomes và remaining gaps.

**Execution record — 2026-10-20:** SL-015 PR #41 was fast-forwarded from `main` into `feature/sl-016-room-lobby-start` (HEAD `23726c6`); no new commit was created. Local TypeScript check (`node node_modules/typescript/bin/tsc --noEmit`) passed. Focused Jest across SL-015 QR/cancel, SL-014 join/create regression and SL-016 start (`node node_modules/jest/bin/jest.js --runInBand __tests__/room-lobby-start.test.ts __tests__/room-create-offline.test.ts __tests__/room-join-pin.test.ts __tests__/group-lobby-cancel-create.test.tsx __tests__/room-join-qr-screen.test.tsx __tests__/room-join-qr.test.ts`) passed: 6 suites, 28 tests. `node --check` passed for the SL-016 Rules test and modified room Rules test files; `git diff --check` passed. Firebase Rules Emulator did not start because `java -version` could not be spawned; Rules behavior is therefore UNVERIFIED. Two-device Expo Go lobby/start remains UNVERIFIED. No Rules/Functions deployment or billing change was made.

## 8. Human review và bàn giao P6.2

Human approval is recorded on 2026-10-20 for the SL-016 scope and the Spark start transaction design in ADR-013/spec. Duyệt một slice không duyệt tất cả 37; duyệt authoring batch không duyệt code.

Sau approval, cập nhật trạng thái/date/decision evidence trong đúng plan; kế hoạch mới chỉ đủ execution-ready khi blocker đã được giải quyết và baseline được re-inspect. Dùng qskill-executing-plans khi user yêu cầu execute plan đã duyệt. Không tự bắt đầu P6.2 từ file draft hoặc từ prompt batch.
