# Kế hoạch triển khai P6.1 — SL-022: Stale room chuyển ABORTED

> **For agentic workers:** REQUIRED SUB-SKILL: Use the qskill-executing-plans skill to implement this plan task-by-task. Steps use checkbox tracking.
> Kế hoạch chỉ mô tả file, unit, hành vi, quy tắc, đầu ra và test cases; không có implementation code hoặc signatures. Đọc source thật trước mỗi task.
> **Gate:** Không execute kế hoạch khi trạng thái còn DRAFT hoặc khi blocker/dependency chưa giải quyết. Việc tạo file này không phê duyệt backlog hay P6.2.

**Mục tiêu:** Stale room chuyển ABORTED: Room ABORTED khi Host stale quá 15 phút; local stats còn.

**Slice:** SL-022. **Ưu tiên đề xuất:** P1. **Release:** MVP + activation/Premium; post-MVP deferred. SL-036 chỉ được tính release sau D6.

**Trạng thái kế hoạch:** APPROVED FOR EXECUTION — human xác nhận triển khai trên Firebase free tier ngày 2026-10-21; D3 cho SL-022 được giải quyết bằng ADR-019.
**Trạng thái implementation quan sát:** Trước execution chưa có heartbeat/stale abort; evidence sẽ được ghi sau implementation.
**Baseline khảo sát:** docs/p6.0-implementation-slices tại 57ca1eb28a2952c66d01f89b9b89bf755ab4812a.
**Ngày soạn:** 2026-10-13, Asia/Saigon.
**Plan slug:** `2026-10-13-sl-022-stale-room-abort`; mọi commit thực hiện plan này phải bắt đầu `[2026-10-13-sl-022-stale-room-abort]`.
**Đầu vào phạm vi:** Backlog P6.0 v0.1; human chỉ duyệt SL-022 trên Spark, không duyệt các slice khác.
**Traceability:** FS §3.1; ARCH §7/9; ADR-006.
**Phụ thuộc bắt buộc:** [SL-017](./2026-10-13-sl-017-group-active.md)
**Ưu tiên mềm:** Theo thứ tự đề xuất trong [mục lục](../../implementation-plan.md); thứ tự không tạo thêm hard dependency.

## 1. Nguồn và ranh giới

Đọc [PRD](../../product-requirements.md), [Feature Spec](../../feature-specification.md), [Product Design](../../product-design.md), [Design Brief](../../product-design-brief.md), [Architecture](../../software-architecture.md), [API contracts](../../api-contracts.md), ADR áp dụng trong [decisions](../../decisions), cùng AGENTS ở app root. Tham chiếu cụ thể của slice nằm trong Traceability phía trên.

V01–V10 chỉ các màn tương ứng tại `design/concepts/concept-final/screens/`; prototype nằm tại `prototype/`. Chúng là read-only visual/interaction references, không chứng minh integration. Nếu journey không có design screen, trình bày gap với human trước quyết định UI mới.

**Kiến trúc:** Host heartbeat và stale abort dùng client Firestore transactions bị giới hạn bởi Rules theo ADR-019. Client timer chỉ kích hoạt thử lệnh; server `request.time` quyết định. Không có scheduled job.

**Stack:** Expo SDK 57 / React Native / TypeScript / Firebase JS SDK / Firestore Standard. Không dùng Cloud Functions, Cloud Scheduler hoặc billing.

**Không gồm:** Always-on background heartbeat, bill settlement từ aborted room.

## 2. Blocker, risk và quyết định cần duyệt

- **D3 — resolved cho SL-022:** ADR-019/API §3.3 chốt heartbeat online-only, foreground cadence 5 phút và khi foreground trở lại; Rules dùng server time. Active/early-exit member có thể thử abort sau 15 phút kể từ `max(hostHeartbeatAt, startedAt)`; `endedAt` bằng cutoff chính xác. Khi mọi client offline, room chỉ hội tụ lúc reconnect. Violation chưa ghi cloud tại cutoff được giữ local-only, không tăng shared score.

**Rủi ro cụ thể:** OS suspension hoặc clock lệch có thể làm client timer chạy trễ/sớm; Firestore Rules vẫn là authority. Không bảo đảm transition khi tất cả client offline.

Contract SL-022 đã được ghi trong ADR-019 và API §3.3. Duyệt này chỉ áp dụng cho stale-room behavior, không mở rộng sang Functions/billing hay các slice khác.

## 3. File và quyền sở hữu dự kiến

Các đường dẫn sau tương đối với `dontlift-mobile/`. Đọc lại trạng thái file lúc execute để chọn Create/Modify; không ghi đè implementation của dependency.

| File dự kiến | Trách nhiệm |
|---|---|
| `src/features/rooms/room-liveness-repository.ts` | Host heartbeat và stale-abort transactions; actor từ Firebase Auth. |
| `src/features/rooms/room-listener.ts` | Expose `hostHeartbeatAt` từ room snapshot. |
| `src/app/index.tsx` | Nối foreground heartbeat/expiry timer với AppState/network và finalize local stats theo cutoff. |
| `firestore.rules` | Host-only heartbeat và active-member stale abort với cutoff/server-time guards. |

**Unit:** Host heartbeat và stale-room abort.
**Nhận:** Host/member đã xác thực, room ACTIVE và heartbeat timestamp.
**Trả:** Room ABORTED khi client online phát hiện Host stale quá 15 phút; local stats còn.
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

### Task 1 — Boundary và quy tắc của Stale room chuyển ABORTED

**Files:** Dùng units/config/backend/repositories trong bảng mục 3; khi test source đã được chỉ định, đặt cases thuộc boundary vào đúng app/backend target. Không thay presentation chưa cần cho task này.

**Nhận/trả:** Nhận server-validated heartbeat và room ACTIVE; trả ABORTED khi client online phát hiện Host stale quá 15 phút; local stats còn. Rules enforce cutoff và transition.

- [ ] Đọc lại source/spec và xác nhận tất cả blocker cùng dependency cho task đã được giải quyết; nếu chưa, dừng execution và báo đúng blocker.
- [ ] Viết focused failing cases sau đây; runner không tìm thấy hoặc thiếu dependency không được tính là red nghiệp vụ.

- [ ] ACTIVE heartbeat mới → không abort.
- [ ] Chỉ authenticated Host của room ACTIVE được heartbeat; Member, outsider, unauthenticated user và Host của room không ACTIVE bị từ chối.
- [ ] Client không thể ghi heartbeat nếu không phải Host; field ngoài allowlist bị từ chối.
- [ ] Stale quá 15 phút → ABORTED một lần.
- [ ] Room COMPLETED/CANCELLED → không đổi ABORTED.

- [ ] Chạy focused command trong mục 7; xác nhận failure đúng behavior đang thiếu, không từ toolchain lỗi.
- [ ] Xây hành vi theo thứ tự sau, chỉ sau approval:

1. Ghi heartbeat bằng client transaction online; derive UID từ Auth, dùng server time và chỉ sửa hai timestamp được Rules cho phép.
2. Gửi heartbeat khi Host vào room ACTIVE/foreground và mỗi 5 phút foreground; không báo thành công nếu transaction lỗi.
3. Room member đặt expiry timer theo heartbeat server snapshot, thử abort khi tới hạn và thử lại khi app foreground/reconnect.
4. Chỉ ACTIVE stale hơn 15 phút đủ điều kiện; server time tránh device clock làm thay đổi quyết định.
5. Rules chỉ nhận abort khi membership hợp lệ và room vẫn ACTIVE; heartbeat/complete/cancel/abort race được recheck atomically.

- [ ] Chạy lại các cases và đối chiếu output/invariants; không tuyên bố native/integration PASS từ mock.
- [ ] Review task và commit chỉ files thuộc task nếu execution được phép. Subject dùng `[2026-10-13-sl-022-stale-room-abort]`, trailer `Plan: docs/superpowers/plans/2026-10-13-sl-022-stale-room-abort.md` và `Task: 1`.

### Task 2 — Journey tích hợp và recovery

**Files:** Presentation/adapter/evidence trong mục 3 cùng boundary task 1; không refactor screen không liên quan. Task này không tạo implementation thứ hai cho unit task 1.

**Nhận:** Output task 1 đã kiểm chứng. **Trả:** Journey/bằng chứng có thể nghiệm thu; error/offline không false-success.

- [ ] Viết các failing cases về integration/recovery sau; không viết tests chỉ mirror implementation.

- [ ] Rules Emulator: active Host được heartbeat; non-Host, outsider, unauthenticated actor và room không ACTIVE bị deny.
- [ ] Client SDK bị từ chối heartbeat trái role và mọi room lifecycle write ngoài allowlist.
- [ ] Heartbeat cập nhật đồng thời scan → transaction recheck.
- [ ] Abort attempt lặp → no duplicate effect.
- [ ] Reconnect aborted room → không tiếp tục capture ngoài window.

- [ ] Chạy focused checks, xác nhận failure đúng behavior; giữ fixtures tách khỏi device evidence.
- [ ] Tích hợp theo thứ tự:

1. Reconnect đọc authoritative ABORTED và dừng active journey theo cutoff server; nếu stale thì gửi abort transaction.
2. Reconcile local lifecycle candidates và đóng open violations theo cutoff; giữ violation chưa sync trong SQLite, không cộng vào shared score.
3. Không hiển thị heartbeat chắc chắn khi OS suspend; client timer không phải deadline authority.

- [ ] Thực hiện các kịch bản nghiệm thu trực tiếp trong mục 6; thu logs an toàn/device timestamps khi cần.
- [ ] Review kết quả; một branch fail hoặc thiếu required device/emulator evidence thì slice chưa hoàn thành.
- [ ] Commit task sau review nếu execution được phép. Subject dùng `[2026-10-13-sl-022-stale-room-abort]`, trailer `Plan: docs/superpowers/plans/2026-10-13-sl-022-stale-room-abort.md` và `Task: 2`.

## 6. Nghiệm thu và failure outcomes

- [ ] ACTIVE heartbeat mới → không abort.
- [ ] Authenticated Host heartbeat refreshes liveness; unauthorized actors and client-side authoritative writes are denied.
- [ ] Client adapter reports heartbeat confirmed only after successful server response; network failure cannot refresh server liveness.
- [ ] Host heartbeat is confirmed only after its online transaction commits.
- [ ] Stale quá 15 phút → ABORTED một lần.
- [ ] Room COMPLETED/CANCELLED → không đổi ABORTED.
- [ ] Heartbeat cập nhật đồng thời scan → transaction recheck.
- [ ] Abort attempt lặp → no duplicate effect.
- [ ] Reconnect aborted room → không tiếp tục capture ngoài window.
- [ ] Rules Emulator clock fixture và device offline protocol → abort/preserve đúng.
- [ ] All clients offline → room remains ACTIVE until a client reconnects; accepted Spark limit.

Mỗi case phải có actual result. Firebase boundary cần Rules Emulator tests cho allowed/denied/race semantics. Sensor/lifecycle cần physical devices. Không có evidence thì ghi UNVERIFIED, không tick PASS.

**Failure recovery bắt buộc:** không hiển thị successful save/transition khi commit/request chưa thành công; giữ dữ liệu/retry context theo hành vi cụ thể trong tasks. Không log email đầy đủ, token, activation code hoặc bank details. Case không áp dụng cho slice phải ghi lý do trong evidence, không bỏ im lặng.

## 7. Verification và ghi nhận evidence

Focused app tests: `pnpm test -- --runInBand --runTestsByPath __tests__/stale-room-abort.test.ts`. Rules Emulator tests cover heartbeat role/state, exact cutoff, terminal race and client write denial. TypeScript: `pnpm exec tsc --noEmit`. Lint: `pnpm run lint` only when repository lint setup is available.

Lệnh app chạy từ `dontlift-mobile/`; file paths tests/backend ở trên là planned targets. Command chỉ được chạy sau harness/dependency prerequisites. Native build/emulator commands phải lấy từ cấu hình thật sau SL-002; không đoán project ID, runtime hoặc production alias. Future schema/index changes được test với approved edition Standard.

Ghi trong kết quả execution: baseline/commit mới, command, exit status, số cases, emulator/device/runtime version, date, actual outcomes và remaining gaps. Các checklist hiện đều chưa chạy.

## 8. Human review và bàn giao P6.2

Human approved the Spark/free-tier scope in the SL-022 conversation on 2026-10-21. ADR-019 resolves D3 for SL-022 only; it does not authorize scheduled jobs, Functions deployment, billing, or other backlog decisions.

Record implementation evidence after execution. Do not deploy Rules or services from this plan; deployment requires a separate user request. Do not start P6.2 from this plan.
