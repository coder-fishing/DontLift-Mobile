# P6.1 — Mục lục kế hoạch DontLift

> **DRAFT v0.16 — backlog P6.0 và các slice chưa được duyệt vẫn là draft.** SL-002, SL-003 và SL-013 đã được duyệt riêng. Những approval này không duyệt toàn bộ backlog.

> **Execution update 2026-10-14:** Human duyệt riêng SL-002 Android development runtime: reuse Firebase cloud config hiện có, iOS device verification tạm hoãn. [Plan SL-002](./superpowers/plans/2026-10-13-sl-002-native-firebase-runtime.md) ghi scope/evidence hiện tại; approval này không duyệt các slice khác hay toàn bộ backlog.

**Ngày soạn:** 2026-10-13, Asia/Saigon.
**Baseline:** `docs/p6.0-implementation-slices`, commit `57ca1eb28a2952c66d01f89b9b89bf755ab4812a`.
**Phạm vi:** MVP + activation/Premium theo lựa chọn human; social login và analytics nâng cao deferred.
**Nguồn slice:** Backlog P6.0 v0.1 đề xuất trong cuộc trò chuyện. Chưa tạo `docs/implementation-slices.md` vì chưa có explicit backlog approval.
**Quyền tác vụ:** SL-002 execution theo update riêng phía trên. Phần còn lại của backlog chỉ được author draft plans; không suy authoring approval thành implementation hoặc provisioning/deployment approval.

## 1. Cách dùng

1. Chọn một slice bên dưới và mở plan tương ứng.
2. Đọc dependencies, blockers, source refs và test cases. Một blocker chưa giải quyết nghĩa là plan chưa execution-ready.
3. Human duyệt scope/non-goals/acceptance/decisions của slice; cập nhật đúng plan với evidence approval.
4. Re-inspect code trên baseline lúc execute; prerequisite có thể đã tạo shared unit, cần reuse thay tạo duplicate.
5. Chỉ chạy P6.2 khi có yêu cầu execute và plan đã approved. Duyệt một plan không duyệt những plan còn lại.

[Prompt P6.1 dùng chung](../prompts/plan-next-slice.prompt.md) hỗ trợ single-slice planning và batch draft authoring khi human yêu cầu rõ. Prompt không tự execute tất cả plans.

## 2. Hiện trạng quan sát

- Baseline có Expo UI/prototype layer; Auth screen PIN mẫu, active session trong memory, participants/PIN mock.
- Calibration dùng timer giả; VietQR là SVG mô phỏng; activation mặc định Pro active.
- Root package manifest tracks the Expo SDK 57 Jest harness from SL-001 and React Native Firebase development runtime from SL-002; `expo-sqlite` is not installed yet. The `test` script is configured; this does not prove SL-003 behavior.
- Không có plan nào đạt production nghiệm thu trên baseline này. Không chạy test/build/device/emulator trong lượt viết tài liệu.
- Auth implementation và historical test evidence trên `feature/registration-login` vẫn là external Git-ref context, không phải implementation evidence cho baseline này. ADR-009 và `completeRegistrationProfile` API §8 đã được tích hợp vào tài liệu canonical. Review report được track trên nhánh Auth chỉ ghi RC-001 về thiếu ESLint setup cho Slice 0A; không thấy finding riêng cho registration trong các report đã kiểm tra. Không dùng Auth source code làm bằng chứng nghiệm thu.
- V01–V10 trong plan là màn 01–10 tại `design/concepts/concept-final/screens/`. Screens/prototype là read-only; không chứng minh adapters hoặc backend đã có.

## 3. Danh sách 37 kế hoạch

P0 là nền tảng/critical journey trước; P1 là cần hoàn tất MVP; P2 là cần chốt feature scope. Dependency là hard prerequisite, không phải thứ tự priority. Trạng thái execution SL-002 theo update riêng ở trên; các draft khác không được duyệt bởi update này.

| ID | Kế hoạch | Priority | Dependency bắt buộc | Blocker riêng |
|---|---|---|---|---|
| SL-001 | [Nền tảng kiểm thử](./superpowers/plans/2026-10-13-sl-001-test-foundation.md) | P0 | Không | Không xác nhận riêng |
| SL-002 | [Development runtime cho Firebase](./superpowers/plans/2026-10-13-sl-002-native-firebase-runtime.md) | P0 | SL-001 | D1 production deferred; E1 iOS/emulator/metadata chưa kiểm chứng |
| SL-003 | [Đăng ký và hoàn tất profile](./superpowers/plans/2026-10-13-sl-003-registration-profile.md) | P0 | SL-002 | E1 acceptance evidence |
| SL-004 | [Login, khôi phục phiên và logout](./superpowers/plans/2026-10-13-sl-004-login-session.md) | P0 | SL-003 | Không xác nhận riêng |
| SL-005 | [Kiểm tra sensor trước khi focus](./superpowers/plans/2026-10-13-sl-005-sensor-availability.md) | P0 | SL-001, SL-002 | E1 |
| SL-006 | [Chọn mode và bắt đầu Solo session](./superpowers/plans/2026-10-13-sl-006-solo-start.md) | P0 | SL-004, SL-005 | Không xác nhận riêng |
| SL-007 | [Detection và grace period foreground](./superpowers/plans/2026-10-13-sl-007-foreground-detection.md) | P0 | SL-003, SL-006 | E1 |
| SL-008 | [Hoàn tất và xem Solo summary](./superpowers/plans/2026-10-13-sl-008-solo-completion.md) | P0 | SL-007 | Không xác nhận riêng |
| SL-009 | [Android background và restart recovery](./superpowers/plans/2026-10-13-sl-009-android-recovery.md) | P0 | SL-003, SL-007 | E1 |
| SL-010 | [iOS background và restart recovery](./superpowers/plans/2026-10-13-sl-010-ios-recovery.md) | P0 | SL-007, SL-009 | E1 |
| SL-011 | [Đồng bộ Solo sau reconnect](./superpowers/plans/2026-10-13-sl-011-solo-sync.md) | P0 | SL-002, SL-008 | D3 |
| SL-012 | [Xem Solo history](./superpowers/plans/2026-10-13-sl-012-solo-history.md) | P1 | SL-011 | Không xác nhận riêng |
| SL-013 | [Host tạo room](./superpowers/plans/2026-10-13-sl-013-room-create.md) | P0 | SL-003, SL-004, SL-006 | Resolved: D12, D13 (2026-10-20) |
| SL-014 | [Member join bằng PIN](./superpowers/plans/2026-10-13-sl-014-room-join-pin.md) | P0 | SL-013 | Resolved: Spark Rules transaction, eight-digit new PIN; direct-read enumeration risk documented (2026-10-20) |
| SL-015 | [Member join bằng QR](./superpowers/plans/2026-10-13-sl-015-room-join-qr.md) | P1 | SL-014 | D13, E1 |
| SL-016 | [Lobby realtime và Host bắt đầu](./superpowers/plans/2026-10-13-sl-016-room-lobby-start.md) | P0 | SL-014 | Resolved: startRoom Spark transaction via ADR-013 (2026-10-20); other D3 decisions remain in owning slices |
| SL-017 | [Group active, capture và leaderboard](./superpowers/plans/2026-10-13-sl-017-group-active.md) | P0 | SL-016, SL-007, SL-009, SL-010, SL-011 | Resolved for group violations by ADR-014 Spark transaction (2026-10-20); other D3 decisions remain in owning slices |
| SL-018 | [Early exit có Host quyết định](./superpowers/plans/2026-10-13-sl-018-early-exit.md) | P1 | SL-017 | D3 |
| SL-019 | [Vote kết thúc sớm](./superpowers/plans/2026-10-13-sl-019-termination-vote.md) | P1 | SL-017, SL-018 | D3 |
| SL-020 | [Host complete và ALL_SYNCED reconciliation](./superpowers/plans/2026-10-13-sl-020-room-completion.md) | P0 | SL-017, SL-018 | D3 |
| SL-021 | [Host override khi còn Member chưa sync](./superpowers/plans/2026-10-13-sl-021-host-finalization-override.md) | P1 | SL-020 | Không xác nhận riêng |
| SL-022 | [Stale room chuyển ABORTED](./superpowers/plans/2026-10-13-sl-022-stale-room-abort.md) | P1 | SL-017 | D3 |
| SL-023 | [Host nhập thông tin nhận tiền](./superpowers/plans/2026-10-13-sl-023-settlement-details.md) | P1 | SL-020 | Không xác nhận riêng |
| SL-024 | [Nhập bill và tính shares mặc định](./superpowers/plans/2026-10-13-sl-024-default-bill.md) | P0 | SL-018, SL-020, SL-023 | D3, D9 |
| SL-025 | [Host override bill shares](./superpowers/plans/2026-10-13-sl-025-bill-overrides.md) | P1 | SL-024 | D8 |
| SL-026 | [Tạo VietQR cho share](./superpowers/plans/2026-10-13-sl-026-vietqr-payment.md) | P1 | SL-024 | E3 |
| SL-027 | [Host đánh dấu đã thanh toán](./superpowers/plans/2026-10-13-sl-027-manual-payment-status.md) | P1 | SL-026 | Không xác nhận riêng |
| SL-028 | [Group history và phục hồi dữ liệu](./superpowers/plans/2026-10-13-sl-028-group-history.md) | P1 | SL-020, SL-012, SL-018, SL-021, SL-024 | D4 |
| SL-029 | [Xem và sửa profile](./superpowers/plans/2026-10-13-sl-029-profile-edit.md) | P1 | SL-004 | Không xác nhận riêng |
| SL-030 | [Settings cho haptic và sound](./superpowers/plans/2026-10-13-sl-030-feedback-settings.md) | P1 | SL-003, SL-004, SL-007 | D11 |
| SL-031 | [Activation offline và Local Premium](./superpowers/plans/2026-10-13-sl-031-local-premium.md) | P1 | SL-003, SL-004, SL-006 | D5 |
| SL-032 | [Redeem online và Server Premium](./superpowers/plans/2026-10-13-sl-032-server-premium.md) | P1 | SL-013, SL-014, SL-031 | D5 |
| SL-033 | [Retention local và server](./superpowers/plans/2026-10-13-sl-033-retention.md) | P1 | SL-012, SL-023, SL-028, SL-031, SL-032 | D10 |
| SL-034 | [Chọn custom theme](./superpowers/plans/2026-10-13-sl-034-premium-themes.md) | P1 | SL-005, SL-008, SL-012, SL-015, SL-019, SL-020, SL-024, SL-026, SL-028, SL-029, SL-030, SL-031 | D6 |
| SL-035 | [Quảng cáo đúng tier và màn hình](./superpowers/plans/2026-10-13-sl-035-free-tier-ads.md) | P1 | SL-006, SL-012, SL-013, SL-016, SL-030, SL-031 | D7 |
| SL-036 | [Advanced leaderboard theo Server Premium](./superpowers/plans/2026-10-13-sl-036-advanced-leaderboard.md) | P2 | SL-017, SL-032 | D6 |
| SL-037 | [Nghiệm thu MVP và phát hành đúng environment](./superpowers/plans/2026-10-13-sl-037-mvp-release.md) | P1 | SL-001–SL-036 | D1, D6, E1, E2, E3 |

SL-037 phụ thuộc bắt buộc SL-001–SL-036 vì phạm vi đã chọn gồm activation/Premium và ADR-007 xác định advanced Penalty Leaderboard là quyền lợi Server Premium. D6 vẫn chặn việc chốt hành vi SL-036; khi D6 chưa được giải quyết thì SL-036 và SL-037 chưa thể nghiệm thu. Completed dependencies không tự làm downstream slice completed.

## 4. Blockers và quyết định cần review

| Mã | Nội dung |
|---|---|
| D1 | Thống nhất tiếp nhận quyết định emulator/dev từ feature/registration-login; xác nhận environment/config và production vẫn riêng. Không provision/deploy khi chưa được cấp quyền. |
| D2 | Đã giải quyết cho SL-003: ADR-009 (human approved 2026-10-06) và API `completeRegistrationProfile` §8 đã được đưa vào tài liệu canonical. Không yêu cầu duyệt lại behavior đã chấp thuận; nếu thay đổi behavior thì cần quyết định mới. |
| D3 | Chốt wire/schema/error/concurrency cho start/early-exit/vote/heartbeat nếu slice dùng chúng; chốt syncEvents cho violation đang kéo dài; chốt early-exit cutoff/eligible events với room-completion pending set và ACK. Không đoán payload từ responsibility table. |
| D4 | Duyệt local completion/cutoff trigger, recovery/schema/identity và destination/projection/query/retention cho history nhóm và GROUP_SESSION_LOCAL_SUMMARY; local summary không tự complete room. |
| D5 | Duyệt checksum cụ thể, test vectors, nguồn code hợp lệ và operational contract cấp code. Website/email mua Premium là external prerequisite, không tự implement. |
| D6 | Duyệt theme catalog/default/downgrade và behavior advanced leaderboard; analytics nâng cao vẫn deferred. D6 tiếp tục chặn nghiệm thu SL-034/036 và downstream SL-037 cho tới khi các hành vi liên quan được chốt. |
| D7 | Duyệt provider ads, test credentials, placements và consent. Giải quyết rõ xung đột PRD: FR-06 bắt buộc Home/Lobby/History/Settings, còn ví dụ US-18 và Product Design có Profile nhưng thiếu Home; áp dụng FR-06 trừ khi có quyết định human mới hơn. |
| D8 | Duyệt recalculation/override sau publication hoặc MARKED_AS_PAID: rule khóa/version/concurrency và outcome UI. |
| D9 | Giải quyết wording non-zero base share khi bill nhỏ/nhiều Members đối nghịch integer/non-negative/exact-sum. Giữ invariant ADR-005; không tự tạo minimum bill per member. |
| D10 | Chốt max retry/retention horizon và receipt TTL; xác định bảo vệ unsynced data trước purge, failed-event retention và expired-read policy. |
| D11 | Chốt default sound state, bundled violation alert asset và user scope của local preferences trước khi SL-030 tạo asset/defaults. |
| D12 | **RESOLVED 2026-10-20:** `Asia/Ho_Chi_Minh`; SL-013 Rules derive monthly bucket from server `request.time` (UTC+07:00), not device clock/timezone. |
| D13 | **UPDATED 2026-10-20:** canonical payload `dontliftmobile://room/{PIN}`; new rooms use 8-digit PINs, legacy 4-digit invitations remain parseable. SL-013 encodes/renders and SL-015 parses the same contract. |
| E1 | Cần Development Build, Android/iOS physical devices, toolchains và Emulator Suite để có native/integration evidence. |
| E2 | Cloud release cần projects/config/billing/scheduled jobs được human cho phép; P6.1 authoring không deploy. |
| E3 | Cần VietQR provider/format và năm banking apps trong cohort để kiểm chứng QR thật. |

D1–D7 và E1/E2 đến từ backlog đề xuất; E3 ghi rõ test cohort đã nêu trong SL-026/037. D8–D11 vẫn là gap chờ human quyết định. D12/D13 được human giải quyết ngày 2026-10-20; D12 thay đổi theo ADR-011 để Rules enforce được quota trên Spark. Giải quyết blocker còn lại bằng evidence/approved decision trước execution, không lấp bằng implementation giả.

D3 chỉ chặn command/event semantics chưa có wire rõ; không blanket-block contract create/join/bill đã có. Mỗi plan nêu phần áp dụng. D6 gồm hai quyết định độc lập về theme catalog và advanced behavior, không gộp approval tùy tiện.

## 5. Coverage và ownership

| Requirement | Owner và outcome |
|---|---|
| US-01 | 003: validation, safe error, account/profile/local completion và retry |
| US-02 | 004: login, SDK persistence/refresh, restore/logout và session isolation |
| US-03 | 006: Countdown/Stopwatch, validate duration, durable start |
| US-04 | 005: sensor gate; 007: orientation/grace/violation/haptic; 009/010: platform recovery |
| US-05 | 008: local completion/summary; 011: cloud delivery |
| US-06 | 013: room/PIN, canonical invitation encoder/QR renderer/dependency và quota theo D12; 032: verified server rights |
| US-07 | 014: PIN/state/capacity/idempotency; 015: scan/parse cùng contract D13 của 013 và two-device round-trip; 032: verified capacity |
| US-08 | 016: roster/Host Start/Member wait/reconnect |
| US-09 | 017: local group capture/authoritative realtime leaderboard; reuse 007/009/010/011 |
| US-10 | 018: request/decision/frozen cutoff và retained participation |
| US-11 | 019: unanimous consensus/expiry/CANCELLED/no settlement; Member đã early-exit được duyệt vẫn giữ trong history nhưng không tính vào voter denominator |
| US-12 | 020: complete/ACK/ALL_SYNCED; 021: Host override/audit/history-only late events |
| US-13 | 024: Host/state/amount validation |
| US-14 | 024: default/zero-score/early-exit/exact integer math; 025: overrides |
| US-15 | 023: details; 026: QR/memo/bank scanning; 027: manual paid |
| US-16 | 012: Solo; 028: Group local-summary producer/atomic outbox, sync consumer và history; 033: retention |
| US-17 | 029: profile/name update and canonical projection |
| US-18 | 030: feedback/settings persistence; 035: ads suppression |
| US-19 | 031: local checksum; 032: server redemption; 033–035 local benefits; 036 scope pending |
| FR-01 | 007: independent engine/preview; 017/020: server aggregate/finalization |
| FR-02 | 006–011: capture/outbox/recovery/delivery; 017 reuse |
| FR-03 | 016–019 và 024–027: realtime authorized state |
| FR-04 | 013/016/019/020/022: authoritative lifecycle |
| FR-05 | 024/025: integer exact-sum shared rounding pipeline |
| FR-06 | 033: local runtime-triggered purge, server summary cleanup and Firestore TTL receipts; 035: nonintrusive ads on Home/Lobby/History/Settings; 013/014/032: entitlement limits |
| NFR/SC-1 | 007/037: stationary false positives dưới 2%, sensor privacy |
| NFR/SC-2 | 011/017/037: eventual delivery, duplicate-safe retry |
| NFR/SC-3 | 024/025/037: zero bill discrepancy |
| NFR/SC-4 | 026/037: QR scan ở năm banking apps |
| NFR/SC-5 | 037: group completion rate trên 85% bằng cohort evidence |
| Token/platform/latency | 002/004/009/010/017/037: native SDK security, Android/iOS, leaderboard không quá 2 giây sau confirmed và synced |

Shared ownership: 001 sở hữu test harness/root lockfile changes; 002 native runtime/local emulator config/default-deny Rules và root lockfiles. 003 sở hữu SQLite dependency/database/migration foundation, backend Functions/Admin package/runtime/lockfiles, Rules test harness và callable emulator handshake; 006 chỉ mở rộng sessions migration/persistence. 007 sở hữu capture/outbox boundary; 011 mở rộng worker/server ingestion; 017 reuse cho group; 018 mở rộng syncEvents cho cutoff riêng của Member và owns cutoff/concurrency tests; 033 mở rộng cùng syncEvents transaction để ghi receipt TTL timestamp theo D10. 013 thêm room/member migration sau sessions migration SL-006. Rules và direct-read ownership được phân theo resource ở bảng dưới; 037 hợp nhất policy đã được resource tests xác nhận vào canonical firestore.rules, chạy lại cùng tests và sở hữu cấu hình/evidence Firestore TTL qua tooling được hỗ trợ sau authorization. 031 sở hữu local entitlement storage cùng SecureStore dependency/config/lockfiles, 032 server redemption. Không coi shared file là quyền refactor unrelated units.

| Resource/path | Slice sở hữu Rules và Emulator Suite | Quyền client dự kiến / giới hạn |
|---|---|---|
| `users/{uid}` | 003 sở hữu owner-only read Rules + Emulator Suite trước profile fetch; 004 kiểm chứng login/restore client flow; 029 chỉ sở hữu allowlisted profile-edit Rules + Emulator Suite | Chỉ owner đọc; chỉ field profile allowlist được phép sửa theo plan 029; entitlement/server fields server-only. |
| `users/{uid}/sessions/{sessionId}` | 012 Solo-history Rules | Owner đọc; client không ghi summary authoritative. |
| `rooms/{roomId}` và `rooms/{roomId}/members/{uid}` | 016 room/member Rules; 022 regression-checks client heartbeat writes and server authorization | Thành viên cùng room đọc; outsider/anonymous/cross-room bị từ chối; client không ghi lifecycle, heartbeat, score hay counters authoritative. |
| `rooms/{roomId}/violations/{eventId}` | 017 Group-active Rules | Thành viên cùng room đọc; leaderboard hiện dùng room/member resources đã được SL-016 cấp read. Không thêm projection path nếu chưa có contract duyệt. |
| Early-exit request resource (path theo contract được duyệt) | 018; sau khi D3 chốt path/schema | Host và requester/member theo policy đã duyệt đọc; client writes chỉ được mở nếu contract/ADR cho phép, mặc định giữ server boundary. |
| Termination-vote resource (path theo contract được duyệt) | 019; sau khi D3 chốt path/schema | Active members đọc trong room; mở client writes chỉ theo contract được duyệt; expiry/finalization server-owned. |
| `rooms/{roomId}/settlementDetails/current` | 023 settlement-details Rules | Thành viên cùng room đọc; chỉ callable/server ghi; không đọc bởi outsider. |
| `rooms/{roomId}/billShares/{uid}` | 024 bill-share Rules; 025–027 reuse và kiểm tra consumer reads | Members đọc breakdown/status; chỉ calculation/payment callables ghi. |
| Group-history queries trên room/member/violation/share resources hiện có | 028 kiểm chứng consumer query sau khi D4 chốt destination/projection | Không tạo path hoặc quyền mới trước D4; reuse Rules của producer cho mọi document được đọc. |
| Advanced leaderboard read model nếu behavior D6 yêu cầu resource mới | 036 sau D6; nếu dùng projection hiện có thì reuse 017 | Chỉ audience/entitlement đã duyệt đọc; mọi projection writes server-only. |
| PIN reservations, usage, command/sync receipts, activation codes, reconciliation audits | 013/014/017/020/021/032 tạo qua backend; 033 stamps approved `expiresAt` on `syncReceipts`; 037 configures and verifies Firestore TTL; Rules mặc định deny | Server-only; không cấp client read/write trực tiếp nếu contract không nêu rõ; TTL chỉ xóa receipt sau D10 horizon, không xóa domain records. |

Mỗi resource owner chạy allowed/denied Emulator Suite tests bằng client SDK: member/owner được phép đọc, anonymous/outsider/cross-room bị deny, và client không thể tạo/sửa/xóa dữ liệu authoritative. Admin SDK chỉ seed fixture, không làm bằng chứng cho quyền client. Các schema/path đang chờ D3/D4/D6 vẫn là blocker; không đoán để làm test pass.

## 6. Thứ tự đề xuất và prerequisite

1. 001 → 002 → 003 → 004.
2. 005 → 006 → 007 → 008; tiếp 009 và 010.
3. 011 → 012.
4. 013 → 014; tiếp 015 và 016 → 017.
5. 018 → 019/020; 022 alongside 018/019; 020 → 021.
6. 023 → 024 → 025 và 026 → 027.
7. 028/029/030.
8. 031 → 032; tiếp 033/034/035; 036 sau decision.
9. 037.

Đây là ưu tiên mềm. Hard dependencies ở bảng trên bao gồm native runtime, migration runner và producer screens khi cần; D5/D11 tiếp tục khóa các quyết định còn mở. Không tạo dependency giả chỉ để ép trình tự tuyến tính. Đồ thị phải được kiểm tra lại khi scope/IDs thay đổi.

## 7. Scope không triển khai và review gate

Deferred: social login; configurable penalty weights per room; extended analytics/analytics dashboards; gamification chưa có spec. Advanced leaderboard có entitlement accepted nhưng behavior chưa đủ, giữ SL-036 blocked thay tự thêm export/insights.

Excluded: kiosk/OS lockdown, wallet/custody, chat/social feed, camera-based phone detection, AI coaching/penalties, automatic bank verification. QR scanning join room không phải camera-based phone-down detection.

Website mua Premium/code generation/email delivery là external operational prerequisite D5; chưa có approved website/backend spec nên không thêm implementation slice tự suy diễn.

**Approval ledger:** SL-002 (Android development), SL-003 (registration profile) và SL-013 (Host tạo room) đã được human duyệt riêng; SL-013 approval ngày 2026-10-20 gồm D12 `Asia/Ho_Chi_Minh`, D13 `dontliftmobile://room/{PIN}` và authority bằng Rules transaction trên Spark. Các slice khác và backlog P6.0 vẫn draft. Không replace approved decisions cũ khi cập nhật index.

**Changelog 2026-10-13:**

- v0.1: Tạo bộ draft cho 37 slice theo human request; thêm prompt dùng chung; nêu D8–D10 và không sửa source.
- v0.2: Human duyệt package sửa năm findings PR #24 trong chat. Bổ sung foundation ownership 003, làm rõ 002/006 và downstream backend prerequisites, resource Rules owners/tests, 028 → 018/021 và deferred deployment owner 037. Giữ 37 IDs và approved product/ADR decisions. Approval chỉ cho corrections, không duyệt backlog, implementation plans, install hoặc deploy.
- v0.3: Human duyệt xử lý findings mới PR #24. Mở rộng Rules ownership theo direct-read resource cho 017–028/036; giao SecureStore dependency/config/lockfiles và persistence failure cases cho 031; đặt 036 thành hard dependency của 037 theo ADR-007, giữ D6 blocker. Không sửa hay phê duyệt backlog P6.0.
- v0.4: Gộp các P1 mới và audit cùng nhóm ownership: sensor dependency; violation/outbox, room/member, lifecycle-candidate, entitlement và app_settings migrations; Android/iOS lifecycle native bridge; Settings navigation cùng audio runtime/assets; SL-034 mở rộng SettingsScreen do SL-030 sở hữu. Cập nhật hard dependencies; thêm D11 cho sound default/asset/user scope. Draft P6.0 vẫn không được sửa hoặc xem là đã duyệt.
- v0.5: Sửa review mới trên PR #24: owner-read `users/{uid}` chuyển tới SL-003 trước login và SL-004 kiểm chứng flow; SL-014 sở hữu PIN navigation; SL-020 route qua reconciliation summary; SL-025 đăng ký callable entrypoint; SL-033 phụ thuộc SL-023; SL-035 phụ thuộc các screen producers. Giữ default deny, edit allowlist ở SL-029, 37 IDs và draft status P6.0.
- v0.6: Sửa review mới trên PR #24: SL-012 sở hữu History route/entry/navigation test; SL-019, SL-021 và SL-033 đăng ký Functions exports cùng discovery coverage; SL-023 nối GroupSummary tới Host settlement form rồi bill allocation; cập nhật draft revision header. Không tự chọn schedule D3/D10/E2, không sửa P6.0 backlog hoặc đổi product behavior.
- v0.7: Sửa review mới trên PR #24: SL-036 không thể tự gỡ hard release gate của SL-037 khi defer; SL-024 phụ thuộc SL-018 vì dùng frozen score; SL-032 phụ thuộc SL-013/014 vì nghiệm thu room quota/capacity. Đồng bộ blocker và dependency index; giữ nguyên accepted ADR-007 scope, D3/D5/D6/D9 và draft status.
- v0.8: SL-013 sở hữu invitation encoder/QR renderer, dependency/lockfiles và canonical contract dùng lại bởi SL-015. Ghi D12 timezone quota và D13 scheme/payload thành blockers, thêm rollover/replay/leading-zero/render-failure/producer-parser scan coverage. Không quyết định timezone/scheme hoặc sửa backlog P6.0.
- v0.9: Sửa source precedence ở prompt P6.1 và prompt P6.0 theo AGENTS; SL-034 sở hữu app-level provider và migration toàn bộ theme consumers cùng producer prerequisites/rendered-state matrix; SL-028 phụ thuộc SL-024 trước share reads. D6 và D4 vẫn mở, quyền lợi theme Local Premium không phụ thuộc redemption Server Premium.
- v0.10: SL-028 sở hữu local group-summary completion hook, schema/recorder/repository và atomic outbox enqueue, với rollback/restart/replay/reconnect coverage; D4 vẫn chặn trigger/schema chưa duyệt. SL-031 phụ thuộc SL-006 để giữ profile/session-before-entitlement migration acceptance. Không queue room completion command hoặc sửa canonical backlog.
- v0.11: SL-018 sở hữu mở rộng syncEvents cho per-member cutoff và boundary/concurrency tests; D3 vẫn chặn policy chưa duyệt. SL-013 phụ thuộc SL-006 để room migration theo sau sessions migration, giữ version và dữ liệu cũ.
- v0.12: SL-022 sở hữu authenticated server heartbeat write path, Functions export, authorization/client-denial Emulator Suite và discovery coverage sau khi D3 chốt contract. SL-019 phụ thuộc SL-018 và kiểm chứng early-exit Member vẫn retained nhưng không làm voter unanimity bất khả thi. Giữ nguyên D3, IDs và trạng thái draft.
- v0.13: SL-020 phụ thuộc SL-018 và kiểm chứng completion/ACK khi early-exit events còn chờ; SL-033 gọi local purge ở app startup/resume, ghi receipt `expiresAt` và dùng native Firestore TTL do SL-037 deploy; SL-035 phụ thuộc SL-006 và theo placement FR-06, ghi xung đột Profile/Home dưới D7. Giữ nguyên 37 IDs, P6.0 draft và D10/D7 gates.

**Changelog 2026-10-14:**

- v0.14: Tích hợp ADR-009 đã accepted và wire contract `completeRegistrationProfile` §8 vào baseline; đồng bộ `users/{uid}` email authority trong architecture; gỡ D2 khỏi SL-003 blocker sau khi đối chiếu tracked Auth review report (RC-001 chỉ thuộc lint Slice 0A). Giữ Auth source/test evidence ngoài baseline.
- v0.15: Human duyệt riêng execution SL-003 ngày 2026-10-14; cập nhật trạng thái approval trong plan và implementation index. Các slice/backlog khác không đổi trạng thái.

**Changelog 2026-10-20:**

- v0.16: Human duyệt riêng SL-013, chốt D12/D13 và chuyển `createRoom` sang client Firestore transaction được Security Rules authorize theo ADR-011 để giữ Firebase Spark. Ghi execution/test evidence và phần còn UNVERIFIED; không triển khai dịch vụ lên Cloud.

**Trạng thái corrections:** [SL-003 review](./superpowers/reviews/2026-10-13-sl-003-registration-profile-review-plan.md), [SL-005 review](./superpowers/reviews/2026-10-13-sl-005-sensor-availability-review-plan.md), [SL-007 review](./superpowers/reviews/2026-10-13-sl-007-foreground-detection-review-plan.md), [SL-009 review](./superpowers/reviews/2026-10-13-sl-009-android-recovery-review-plan.md), [SL-010 review](./superpowers/reviews/2026-10-13-sl-010-ios-recovery-review-plan.md), [SL-013 review](./superpowers/reviews/2026-10-13-sl-013-room-create-review-plan.md), [SL-016 review](./superpowers/reviews/2026-10-13-sl-016-room-lobby-start-review-plan.md), [SL-028 review](./superpowers/reviews/2026-10-13-sl-028-group-history-review-plan.md), [SL-029 review](./superpowers/reviews/2026-10-13-sl-029-profile-edit-review-plan.md), [SL-030 review](./superpowers/reviews/2026-10-13-sl-030-feedback-settings-review-plan.md), [SL-031 review](./superpowers/reviews/2026-10-13-sl-031-local-premium-review-plan.md), [SL-034 review](./superpowers/reviews/2026-10-13-sl-034-premium-themes-review-plan.md), [SL-037 review](./superpowers/reviews/2026-10-13-sl-037-mvp-release-review-plan.md).

Review batch v0.5: [SL-014](./superpowers/reviews/2026-10-13-sl-014-room-join-pin-review-plan.md), [SL-020](./superpowers/reviews/2026-10-13-sl-020-room-completion-review-plan.md), [SL-025](./superpowers/reviews/2026-10-13-sl-025-bill-overrides-review-plan.md), [SL-033](./superpowers/reviews/2026-10-13-sl-033-retention-review-plan.md), [SL-035](./superpowers/reviews/2026-10-13-sl-035-free-tier-ads-review-plan.md); SL-003 profile owner-read is appended to its existing review report.

Review batch v0.6: [SL-012](./superpowers/reviews/2026-10-13-sl-012-solo-history-review-plan.md), [SL-019](./superpowers/reviews/2026-10-13-sl-019-termination-vote-review-plan.md), [SL-021](./superpowers/reviews/2026-10-13-sl-021-host-finalization-override-review-plan.md), [SL-023](./superpowers/reviews/2026-10-13-sl-023-settlement-details-review-plan.md), [SL-033](./superpowers/reviews/2026-10-13-sl-033-retention-review-plan.md), [Index](./superpowers/reviews/2026-10-13-implementation-plan-review-plan.md).

Review batch v0.7: [SL-024](./superpowers/reviews/2026-10-13-sl-024-default-bill-review-plan.md), [SL-032](./superpowers/reviews/2026-10-13-sl-032-server-premium-review-plan.md), [SL-036](./superpowers/reviews/2026-10-13-sl-036-advanced-leaderboard-review-plan.md).

Review batch v0.8: [SL-013](./superpowers/reviews/2026-10-13-sl-013-room-create-review-plan.md), [SL-015 synchronization](./superpowers/reviews/2026-10-13-sl-015-room-join-qr-review-plan.md).

Review batch v0.9: [Prompt precedence](./superpowers/reviews/2026-10-13-implementation-plan-review-plan.md), [SL-034](./superpowers/reviews/2026-10-13-sl-034-premium-themes-review-plan.md), [SL-028](./superpowers/reviews/2026-10-13-sl-028-group-history-review-plan.md).

Review batch v0.10: [SL-028](./superpowers/reviews/2026-10-13-sl-028-group-history-review-plan.md), [SL-031](./superpowers/reviews/2026-10-13-sl-031-local-premium-review-plan.md).

Review batch v0.11: [SL-018](./superpowers/reviews/2026-10-13-sl-018-early-exit-review-plan.md) sở hữu mở rộng syncEvents cho per-member cutoff và boundary/concurrency tests; D3 vẫn chặn policy chưa duyệt. [SL-013](./superpowers/reviews/2026-10-13-sl-013-room-create-review-plan.md) thêm hard dependency SL-006 để room migration theo sau sessions migration thật, giữ version và dữ liệu cũ.

Review batch v0.12: [SL-022](./superpowers/reviews/2026-10-13-sl-022-stale-room-abort-review-plan.md) bổ sung server heartbeat writer và authorization/discovery coverage; [SL-019](./superpowers/reviews/2026-10-13-sl-019-termination-vote-review-plan.md) thêm SL-018 hard dependency và early-exit/vote roster integration case.

Review batch v0.13: [SL-020](./superpowers/reviews/2026-10-13-sl-020-room-completion-review-plan.md) thêm early-exit reconciliation dependency/cases; [SL-033](./superpowers/reviews/2026-10-13-sl-033-retention-review-plan.md) nối local retention runtime và receipt TTL ownership; [SL-035](./superpowers/reviews/2026-10-13-sl-035-free-tier-ads-review-plan.md) khôi phục Home placement/dependency và ghi rõ D7 source conflict.
