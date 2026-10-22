# SL-028 — Group history và phục hồi dữ liệu

Trạng thái: APPROVED — human duyệt D4 và Spark ngày 2026-10-22.
Plan slug: 2026-10-13-sl-028-group-history.
Nhánh: feature/sl-028-group-history; checkout thật D:\DontLift-Mobile.
Thiết kế: ../specs/2026-10-22-sl-028-group-history-spark-design.md; ADR-024.

D4 được chốt theo thiết kế: cutoff server đã biết, summary/outbox SQLite nguyên tử, owner cloud index và window hiển thị. Không Functions/billing/deploy. Không commit/push khi chưa được yêu cầu.

## Task 1 — Ghi local summary bền vững

Files: migrations.ts, group-summary-repository.ts, group-history-model.ts, room-lobby-projection.ts.

- [x] Migration mới giữ dữ liệu cũ, actor/room primary key; có durable summary/outbox UUID.
- [x] Ghi sau capture drain, candidate reconcile và cutoff normalization; cùng transaction với projection completion.
- [x] Replay/restart không tạo summary/event trùng; rollback không partial.
- [x] Startup phục hồi terminal/early-exit recordings chưa có summary từ durable server cutoff.

## Task 2 — Đồng bộ và đọc history trên Spark

Files: group-history-repository.ts, firestore.rules, API §4, app integration.

- [x] Create-only owner history transaction, exact replay và Rules membership/cutoff/schema.
- [x] Worker account-scoped chạy độc lập selected room/screen; lỗi từng event không chặn các room khác.
- [x] Pagination local/cloud, stable identity, pending/failed visibility và entitlement separation.
- [x] Canonical detail và late-excluded explanation đọc theo membership, không cache bank details.

## Task 3 — UI history

Files: GroupHistoryScreen.tsx, GroupLobbyScreen.tsx, types/constants/BottomNav, app/index.tsx.

- [x] Entry từ Group home; list/detail/back, empty/loading/error/offline/syncing và explicit retry.
- [x] Phân biệt local stats với frozen score, bill revision/payment status khi còn được đọc.
- [x] Dùng ui-ux-pro-max/react-native-expert/core antislop, semantic tokens, accessible targets.

## Task 4 — Kiểm chứng và review

- [x] Focused repository/model/controller/UI tests, migration rollback/restart và cursor overlap.
- [x] Rules Emulator Standard/demo cho owner/member/outsider, cutoff và replay, immutable payload.
- [x] TypeScript/diff check; lint chỉ với cấu hình thật, không tự lint migration.
- [x] Ghi rõ physical Expo Go và các check bị chặn; không claim nghiệm thu từ mocks.

Nguồn: product requirements US-16, product design, architecture §6–8, API §5/§5.2; producer SL-018/020/021/024/025/027. Không public room history, không analytics/purge, không canonical score/bill recalculation.

## Evidence — 2026-10-22

- Implementation xong trên checkout thật; không commit/push/deploy.
- Migration 10 lưu group_history theo actor/room; migration 8 nhận lại schema PIN mới nếu user_version bị reset, bảo toàn cột reconciliation. SQLite tests xác minh rollback, v9 upgrade, restart recovery và account isolation.
- Cache roster/điểm theo tài khoản được nối sau completion/early-exit và snapshot persistence; không lưu bank details/QR. Cache FINALIZED không bị snapshot PENDING hạ xuống.
- Jest liên quan: 84 tests / 9 suites PASS. TypeScript và git diff --check PASS. Rules Emulator Standard/demo: 21 checks PASS (8 history, 13 payment regression). Node 24.14.1; Firebase JS 13.0.0.
- UI stack search: ui-ux-pro-max/react-native FlatList result, áp dụng virtualization cho list và roster detail. Core antislop trong lúc làm; không cài thêm module/dependency.
- Lint chưa chạy vì checkout không có eslint.config.*; không để Expo tự tạo config/migration ngoài phạm vi.
- [ ] Physical Expo Go Android/iOS với hai tài khoản: offline completion/restart/reconnect, approved early exit, HOST_OVERRIDE late events, scroll/touch/safe areas. Đây là evidence còn thiếu, không suy từ mocked render.
- [ ] Cloud Rules chưa deploy; app runtime vẫn Firebase Cloud/Spark. Emulator chỉ dùng kiểm tra local.

## Bổ sung được human duyệt — mở lại QR từ lịch sử

- [x] Nút Pay my share cho own share dương chưa được Host xác nhận.
- [x] Tách subscription lịch sử khỏi selected room đang chạy; back về đúng session detail.
- [x] Chỉ dùng server-confirmed room/member/bill/details; đối chiếu pointer/revision/paid count trước QR.
- [x] Offline, cached, revoked, expired, paid/zero và revision change không hiển thị QR cũ; không thêm write/Rules/bank cache.
- [x] Kiểm tra service và navigation reuse VietQR; physical Expo Go vẫn cần nghiệm thu.

## Review follow-up: terminal snapshot consistency

Apply ADR-024 narrow correction: confirm room + own membership together before history upload, preserve the same outbox event ID, and normalize EARLY_EXIT to min(earlyExitAt, terminal endedAt). Recheck uploaded exits until terminal authority is known. Permit only server-bound status/cutoff corrections with non-increasing stats; guard local ACK/failure by payload. Cover mixed CANCELLED/ACTIVE listener ordering, later backdated abort, identity protection, migration 11 and stale ACK regression.
