# P6.1 — Mục lục kế hoạch DontLift

> **DRAFT v0.2 — backlog và implementation plans chưa được phê duyệt.** Đây là bộ kế hoạch được user yêu cầu soạn và lưu để review cho 37 slice, không phải backlog P6.0 đã duyệt và không phải quyền chạy P6.2.

**Ngày soạn:** 2026-10-13, Asia/Saigon.
**Baseline:** `docs/p6.0-implementation-slices`, commit `57ca1eb28a2952c66d01f89b9b89bf755ab4812a`.
**Phạm vi:** MVP + activation/Premium theo lựa chọn human; social login và analytics nâng cao deferred.
**Nguồn slice:** Backlog P6.0 v0.1 đề xuất trong cuộc trò chuyện. Chưa tạo `docs/implementation-slices.md` vì chưa có explicit backlog approval.
**Quyền tác vụ hiện tại:** Author draft plans; không implement, không sửa code, không provision/deploy, không suy authoring approval thành plan approval.

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
- Package manifest chưa có React Native Firebase/SQLite/test dependencies được track như nhánh Auth; chưa có test script.
- Không có plan nào đạt production nghiệm thu trên baseline này. Không chạy test/build/device/emulator trong lượt viết tài liệu.
- P6.1 template, Auth implementation, ADR-009 và test evidence ở `feature/registration-login` là external Git-ref context; chưa merged vào baseline và còn các lỗi review cần sửa.
- V01–V10 trong plan là màn 01–10 tại `design/concepts/concept-final/screens/`. Screens/prototype là read-only; không chứng minh adapters hoặc backend đã có.

## 3. Danh sách 37 kế hoạch

P0 là nền tảng/critical journey trước; P1 là cần hoàn tất MVP; P2 là cần chốt feature scope. Dependency là hard prerequisite, không phải thứ tự priority. Mọi plan vẫn DRAFT.

| ID | Kế hoạch | Priority | Dependency bắt buộc | Blocker riêng |
|---|---|---|---|---|
| SL-001 | [Nền tảng kiểm thử](./superpowers/plans/2026-10-13-sl-001-test-foundation.md) | P0 | Không | Không xác nhận riêng |
| SL-002 | [Development runtime cho Firebase](./superpowers/plans/2026-10-13-sl-002-native-firebase-runtime.md) | P0 | SL-001 | D1, E1 |
| SL-003 | [Đăng ký và hoàn tất profile](./superpowers/plans/2026-10-13-sl-003-registration-profile.md) | P0 | SL-002 | D2 |
| SL-004 | [Login, khôi phục phiên và logout](./superpowers/plans/2026-10-13-sl-004-login-session.md) | P0 | SL-003 | Không xác nhận riêng |
| SL-005 | [Kiểm tra sensor trước khi focus](./superpowers/plans/2026-10-13-sl-005-sensor-availability.md) | P0 | SL-001 | E1 |
| SL-006 | [Chọn mode và bắt đầu Solo session](./superpowers/plans/2026-10-13-sl-006-solo-start.md) | P0 | SL-004, SL-005 | Không xác nhận riêng |
| SL-007 | [Detection và grace period foreground](./superpowers/plans/2026-10-13-sl-007-foreground-detection.md) | P0 | SL-006 | E1 |
| SL-008 | [Hoàn tất và xem Solo summary](./superpowers/plans/2026-10-13-sl-008-solo-completion.md) | P0 | SL-007 | Không xác nhận riêng |
| SL-009 | [Android background và restart recovery](./superpowers/plans/2026-10-13-sl-009-android-recovery.md) | P0 | SL-007 | E1 |
| SL-010 | [iOS background và restart recovery](./superpowers/plans/2026-10-13-sl-010-ios-recovery.md) | P0 | SL-007 | E1 |
| SL-011 | [Đồng bộ Solo sau reconnect](./superpowers/plans/2026-10-13-sl-011-solo-sync.md) | P0 | SL-002, SL-008 | D3 |
| SL-012 | [Xem Solo history](./superpowers/plans/2026-10-13-sl-012-solo-history.md) | P1 | SL-011 | Không xác nhận riêng |
| SL-013 | [Host tạo room](./superpowers/plans/2026-10-13-sl-013-room-create.md) | P0 | SL-004 | Không xác nhận riêng |
| SL-014 | [Member join bằng PIN](./superpowers/plans/2026-10-13-sl-014-room-join-pin.md) | P0 | SL-013 | Không xác nhận riêng |
| SL-015 | [Member join bằng QR](./superpowers/plans/2026-10-13-sl-015-room-join-qr.md) | P1 | SL-014 | E1 |
| SL-016 | [Lobby realtime và Host bắt đầu](./superpowers/plans/2026-10-13-sl-016-room-lobby-start.md) | P0 | SL-014 | D3 |
| SL-017 | [Group active, capture và leaderboard](./superpowers/plans/2026-10-13-sl-017-group-active.md) | P0 | SL-016, SL-007, SL-009, SL-010, SL-011 | D3 |
| SL-018 | [Early exit có Host quyết định](./superpowers/plans/2026-10-13-sl-018-early-exit.md) | P1 | SL-017 | D3 |
| SL-019 | [Vote kết thúc sớm](./superpowers/plans/2026-10-13-sl-019-termination-vote.md) | P1 | SL-017 | D3 |
| SL-020 | [Host complete và ALL_SYNCED reconciliation](./superpowers/plans/2026-10-13-sl-020-room-completion.md) | P0 | SL-017 | Không xác nhận riêng |
| SL-021 | [Host override khi còn Member chưa sync](./superpowers/plans/2026-10-13-sl-021-host-finalization-override.md) | P1 | SL-020 | Không xác nhận riêng |
| SL-022 | [Stale room chuyển ABORTED](./superpowers/plans/2026-10-13-sl-022-stale-room-abort.md) | P1 | SL-017 | D3 |
| SL-023 | [Host nhập thông tin nhận tiền](./superpowers/plans/2026-10-13-sl-023-settlement-details.md) | P1 | SL-020 | Không xác nhận riêng |
| SL-024 | [Nhập bill và tính shares mặc định](./superpowers/plans/2026-10-13-sl-024-default-bill.md) | P0 | SL-020, SL-023 | D9 |
| SL-025 | [Host override bill shares](./superpowers/plans/2026-10-13-sl-025-bill-overrides.md) | P1 | SL-024 | D8 |
| SL-026 | [Tạo VietQR cho share](./superpowers/plans/2026-10-13-sl-026-vietqr-payment.md) | P1 | SL-024 | E3 |
| SL-027 | [Host đánh dấu đã thanh toán](./superpowers/plans/2026-10-13-sl-027-manual-payment-status.md) | P1 | SL-026 | Không xác nhận riêng |
| SL-028 | [Group history và phục hồi dữ liệu](./superpowers/plans/2026-10-13-sl-028-group-history.md) | P1 | SL-020, SL-012, SL-018, SL-021 | D4 |
| SL-029 | [Xem và sửa profile](./superpowers/plans/2026-10-13-sl-029-profile-edit.md) | P1 | SL-004 | Không xác nhận riêng |
| SL-030 | [Settings cho haptic và sound](./superpowers/plans/2026-10-13-sl-030-feedback-settings.md) | P1 | SL-007 | Không xác nhận riêng |
| SL-031 | [Activation offline và Local Premium](./superpowers/plans/2026-10-13-sl-031-local-premium.md) | P1 | SL-004 | D5 |
| SL-032 | [Redeem online và Server Premium](./superpowers/plans/2026-10-13-sl-032-server-premium.md) | P1 | SL-031 | D5 |
| SL-033 | [Retention local và server](./superpowers/plans/2026-10-13-sl-033-retention.md) | P1 | SL-012, SL-028, SL-031, SL-032 | D10 |
| SL-034 | [Chọn custom theme](./superpowers/plans/2026-10-13-sl-034-premium-themes.md) | P1 | SL-031 | D6 |
| SL-035 | [Quảng cáo đúng tier và màn hình](./superpowers/plans/2026-10-13-sl-035-free-tier-ads.md) | P1 | SL-031, SL-030 | D7 |
| SL-036 | [Advanced leaderboard theo Server Premium](./superpowers/plans/2026-10-13-sl-036-advanced-leaderboard.md) | P2 | SL-017, SL-032 | D6 |
| SL-037 | [Nghiệm thu MVP và phát hành đúng environment](./superpowers/plans/2026-10-13-sl-037-mvp-release.md) | P1 | SL-001, SL-002, SL-003, SL-004, SL-005, SL-006, SL-007, SL-008, SL-009, SL-010, SL-011, SL-012, SL-013, SL-014, SL-015, SL-016, SL-017, SL-018, SL-019, SL-020, SL-021, SL-022, SL-023, SL-024, SL-025, SL-026, SL-027, SL-028, SL-029, SL-030, SL-031, SL-032, SL-033, SL-034, SL-035 | D1, E1, E2, E3 |

SL-037 phụ thuộc 001–035; thêm 036 nếu D6 xác nhận advanced leaderboard thuộc MVP. Chưa giải quyết D6 thì không được coi release-scope hoàn chỉnh. Completed dependencies không tự làm downstream slice completed.

## 4. Blockers và quyết định cần review

| Mã | Nội dung |
|---|---|
| D1 | Thống nhất tiếp nhận quyết định emulator/dev từ feature/registration-login; xác nhận environment/config và production vẫn riêng. Không provision/deploy khi chưa được cấp quyền. |
| D2 | Tiếp nhận hoặc duyệt ADR-009 và wire contract completeRegistrationProfile từ nhánh Auth; chúng chưa thuộc baseline này. |
| D3 | Chốt wire/schema/error/concurrency cho start/early-exit/vote/heartbeat nếu slice dùng chúng; chốt syncEvents cho violation đang kéo dài khi áp dụng. Không đoán payload từ responsibility table. |
| D4 | Duyệt destination/projection/query/retention cho history nhóm và GROUP_SESSION_LOCAL_SUMMARY. |
| D5 | Duyệt checksum cụ thể, test vectors, nguồn code hợp lệ và operational contract cấp code. Website/email mua Premium là external prerequisite, không tự implement. |
| D6 | Duyệt theme catalog/default/downgrade và behavior advanced leaderboard; analytics nâng cao vẫn deferred. |
| D7 | Duyệt provider ads, test credentials, placements và consent requirements áp dụng. |
| D8 | Duyệt recalculation/override sau publication hoặc MARKED_AS_PAID: rule khóa/version/concurrency và outcome UI. |
| D9 | Giải quyết wording non-zero base share khi bill nhỏ/nhiều Members đối nghịch integer/non-negative/exact-sum. Giữ invariant ADR-005; không tự tạo minimum bill per member. |
| D10 | Chốt max retry/retention horizon và receipt TTL; xác định bảo vệ unsynced data trước purge, failed-event retention và expired-read policy. |
| E1 | Cần Development Build, Android/iOS physical devices, toolchains và Emulator Suite để có native/integration evidence. |
| E2 | Cloud release cần projects/config/billing/scheduled jobs được human cho phép; P6.1 authoring không deploy. |
| E3 | Cần VietQR provider/format và năm banking apps trong cohort để kiểm chứng QR thật. |

D1–D7 và E1/E2 đến từ backlog đề xuất; E3 ghi rõ test cohort đã nêu trong SL-026/037. D8–D10 là các gap phát hiện khi viết chi tiết, **đề xuất để human quyết định**, chưa phải thay đổi accepted product/architecture. Giải quyết chúng bằng evidence/approved decision trước execution, không lấp bằng implementation giả.

D3 chỉ chặn command/event semantics chưa có wire rõ; không blanket-block contract create/join/bill đã có. Mỗi plan nêu phần áp dụng. D6 gồm hai quyết định độc lập về theme catalog và advanced behavior, không gộp approval tùy tiện.

## 5. Coverage và ownership

| Requirement | Owner và outcome |
|---|---|
| US-01 | 003: validation, safe error, account/profile/local completion và retry |
| US-02 | 004: login, SDK persistence/refresh, restore/logout và session isolation |
| US-03 | 006: Countdown/Stopwatch, validate duration, durable start |
| US-04 | 005: sensor gate; 007: orientation/grace/violation/haptic; 009/010: platform recovery |
| US-05 | 008: local completion/summary; 011: cloud delivery |
| US-06 | 013: room/PIN/invitation/quota; 032: verified server rights |
| US-07 | 014: PIN/state/capacity/idempotency; 015: QR; 032: verified capacity |
| US-08 | 016: roster/Host Start/Member wait/reconnect |
| US-09 | 017: local group capture/authoritative realtime leaderboard; reuse 007/009/010/011 |
| US-10 | 018: request/decision/frozen cutoff và retained participation |
| US-11 | 019: unanimous consensus/expiry/CANCELLED/no settlement |
| US-12 | 020: complete/ACK/ALL_SYNCED; 021: Host override/audit/history-only late events |
| US-13 | 024: Host/state/amount validation |
| US-14 | 024: default/zero-score/early-exit/exact integer math; 025: overrides |
| US-15 | 023: details; 026: QR/memo/bank scanning; 027: manual paid |
| US-16 | 012: Solo; 028: Group; 033: retention |
| US-17 | 029: profile/name update and canonical projection |
| US-18 | 030: feedback/settings persistence; 035: ads suppression |
| US-19 | 031: local checksum; 032: server redemption; 033–035 local benefits; 036 scope pending |
| FR-01 | 007: independent engine/preview; 017/020: server aggregate/finalization |
| FR-02 | 006–011: capture/outbox/recovery/delivery; 017 reuse |
| FR-03 | 016–019 và 024–027: realtime authorized state |
| FR-04 | 013/016/019/020/022: authoritative lifecycle |
| FR-05 | 024/025: integer exact-sum shared rounding pipeline |
| FR-06 | 033: purge; 035: nonintrusive ads; 013/014/032: entitlement limits |
| NFR/SC-1 | 007/037: stationary false positives dưới 2%, sensor privacy |
| NFR/SC-2 | 011/017/037: eventual delivery, duplicate-safe retry |
| NFR/SC-3 | 024/025/037: zero bill discrepancy |
| NFR/SC-4 | 026/037: QR scan ở năm banking apps |
| NFR/SC-5 | 037: group completion rate trên 85% bằng cohort evidence |
| Token/platform/latency | 002/004/009/010/017/037: native SDK security, Android/iOS, leaderboard không quá 2 giây sau confirmed và synced |

Shared ownership: 001 sở hữu test harness/root lockfile changes; 002 native runtime/local emulator config/default-deny Rules và root lockfiles. 003 sở hữu SQLite dependency/database/migration foundation, backend Functions/Admin package/runtime/lockfiles, Rules test harness và callable emulator handshake; 006 chỉ mở rộng sessions migration/persistence. 007 sở hữu capture/outbox boundary; 011 mở rộng worker/server ingestion; 017 reuse cho group. 012 mở rộng Solo-history Rules, 016 room/member Rules, 029 profile read/edit Rules; giữ default-deny/regression. 037 sở hữu canonical .firebaserc/firebase.json/firestore.rules/firestore.indexes.json, tiếp nhận tested policies/query inventory và permission/deploy/smoke gates. 024 sở hữu allocation engine, 025 reuse cùng rounding. 031 sở hữu local entitlement storage, 032 server redemption. Không coi shared file là quyền refactor unrelated units.

## 6. Thứ tự đề xuất và prerequisite

1. 001 → 002 → 003 → 004.
2. 005 → 006 → 007 → 008; tiếp 009 và 010.
3. 011 → 012.
4. 013 → 014; tiếp 015 và 016 → 017.
5. 018/019/022; 020 → 021.
6. 023 → 024 → 025 và 026 → 027.
7. 028/029/030.
8. 031 → 032; tiếp 033/034/035; 036 sau decision.
9. 037.

Đây là ưu tiên mềm. 029 có thể plan/execute sau 004, 030 sau 007, 031 sau 004 khi checksum/approval đã rõ. Không tạo dependency giả chỉ để ép trình tự tuyến tính. Đồ thị phải được kiểm tra lại khi scope/IDs thay đổi.

## 7. Scope không triển khai và review gate

Deferred: social login; configurable penalty weights per room; extended analytics/analytics dashboards; gamification chưa có spec. Advanced leaderboard có entitlement accepted nhưng behavior chưa đủ, giữ SL-036 blocked thay tự thêm export/insights.

Excluded: kiosk/OS lockdown, wallet/custody, chat/social feed, camera-based phone detection, AI coaching/penalties, automatic bank verification. QR scanning join room không phải camera-based phone-down detection.

Website mua Premium/code generation/email delivery là external operational prerequisite D5; chưa có approved website/backend spec nên không thêm implementation slice tự suy diễn.

**Approval ledger:** Chưa có backlog/plan approved trong bộ này. Khi human duyệt, ghi plan ID, version/date, scope/acceptance/decision đã duyệt và remaining blockers. Không replace approved decisions cũ khi cập nhật index. Draft batch không đồng nghĩa P6.0 đã approved.

**Changelog 2026-10-13:**

- v0.1: Tạo bộ draft cho 37 slice theo human request; thêm prompt dùng chung; nêu D8–D10 và không sửa source.
- v0.2: Human duyệt package sửa năm findings PR #24 trong chat. Bổ sung foundation ownership 003, làm rõ 002/006 và downstream backend prerequisites, resource Rules owners/tests, 028 → 018/021 và deferred deployment owner 037. Giữ 37 IDs và approved product/ADR decisions. Approval chỉ cho corrections, không duyệt backlog, implementation plans, install hoặc deploy.

**Trạng thái corrections:** [SL-003 review](./superpowers/reviews/2026-10-13-sl-003-registration-profile-review-plan.md), [SL-016 review](./superpowers/reviews/2026-10-13-sl-016-room-lobby-start-review-plan.md), [SL-028 review](./superpowers/reviews/2026-10-13-sl-028-group-history-review-plan.md), [SL-037 review](./superpowers/reviews/2026-10-13-sl-037-mvp-release-review-plan.md).
