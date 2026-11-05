# Lịch sử nhóm dùng chung — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use the qskill-executing-plans skill to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
> This plan is intentionally skeleton-level: it specifies files, signatures, behavior and test cases, NOT implementation code. Read the real files before writing each task's code.

**Goal:** Hiển thị phòng đã kết thúc trong History của mọi tài khoản còn membership hợp lệ, với kết quả chung được đọc từ dữ liệu phòng hiện có.

**Architecture:** Mỗi UID giữ chỉ mục riêng `users/{uid}/groupRooms/{roomId}`. Sau khi tạo/tham gia phòng, app ghi chỉ mục theo cách best-effort; lỗi chỉ mục không làm thao tác phòng đã commit bị báo thất bại. Repository History chỉ đọc các chỉ mục của UID hiện tại, xác minh room và membership, rồi hợp nhất dữ liệu phòng với personal summary cũ.

**Tech Stack:** React Native, TypeScript, Firebase JS SDK / Cloud Firestore Spark, Firestore Security Rules, Expo SQLite.

**Spec:** `docs/superpowers/specs/2026-11-04-shared-group-history-design.md`

**Plan slug:** `2026-11-04-shared-group-history` — every commit for this plan starts with `[2026-11-04-shared-group-history]` (no commit unless requested).

## Global Constraints

- No Cloud Functions, billing, production deploy, or broad room query.
- Never read another account's `users/{uid}` subtree.
- Keep existing personal summary/outbox and canonical room score/bill sources distinct.
- Only `ACTIVE` / `EARLY_EXIT` members can list and read their room history.
- Follow semantic tokens and current pagination/retention behavior.

---

### Task 1: Member-owned room index

**Files:**
- Modify: `src/features/rooms/room-repository.ts`
- Modify: `firestore.rules`
- Modify: `docs/api-contracts.md`

**Behavior:**
1. After create/join commits, best-effort create Host and Member indexes using the verified member's server `joinedAt`.
2. Repair a missing index on idempotent create/join replay or History refresh only after the matching room membership is verified. History backfill is limited to memberships already present in this device's local projection.
3. Allow only owner reads; accept an index write only when the matching member record exists and room ID/timestamp agree.
4. Do not store role, score, bill, payment, or display-name data in the index.

**Cases:** new host/member gets one index when the best-effort write succeeds; replay creates no duplicate; mismatched UID, room, joinedAt, outsider, and deleted membership are denied.

- [x] Implemented owner-scoped index creation and Rules validation. Index creation follows the room transaction so a Rules rollout cannot block a room that was already created/joined.

### Task 2: Shared room history projection

**Files:**
- Modify: `src/features/history/group-history-repository.ts`
- Modify: `src/features/history/group-history-model.ts`
- Modify: `src/features/history/group-history-cache.ts`
- Modify: `src/screens/GroupHistoryScreen.tsx`
- Modify: `src/app/index.tsx`

**Behavior:**
1. Query only the current user's room-index collection.
2. For each candidate, load room and own membership; include only terminal rooms and eligible memberships.
3. Build missing History rows from canonical timestamps and the current member's canonical counters; never substitute device time.
4. Keep existing local personal summaries when present and leave outbox/sync state untouched.
5. Read shared roster, room result and bill through existing membership-scoped detail repositories.
6. Cache safe room detail for offline reopen, excluding bank account details and QR data.
7. On online History refresh, backfill only legacy rooms known in the current device's local `rooms`/`room_members` projection.

**Cases:** host and each member get the same ended room; pending reconciliation is visible; waiting/active rooms are omitted; outsiders/revoked membership are omitted; local pending summary is preserved; offline uses only saved data; pagination/retention remain stable.

- [x] Implemented shared-result projection/cache, personal-summary precedence, Group History detail reuse, and source labels.

### Task 3: Security documentation and compatibility

**Files:**
- Create: `docs/decisions/ADR-028-shared-group-history-index.md`
- Modify: this implementation plan as tasks complete

**Behavior:** Record this accepted extension to ADR-024, legacy-device limitations, owner index boundaries and no-Functions constraint.

- [x] Added ADR-028, API contract notes, and architecture guidance.

### Task 4: Verification

**Files:** existing Firestore Rules and Group History coverage.

**Cases:** rules emulator validates owner/outsider/member access and transaction links; repository verifies room-to-entry projection, personal-summary precedence, retention and revoked membership; TypeScript check confirms UI/repository contracts.

**Commands:** `pnpm exec tsc --noEmit`; focused Jest and Firestore Emulator commands may be run when verification is requested.

- [ ] Firestore Emulator and UI flow verification remain outstanding; no tests or Rules deployment were run in this pass.
