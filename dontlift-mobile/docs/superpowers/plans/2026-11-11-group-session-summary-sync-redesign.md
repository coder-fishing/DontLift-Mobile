# Group Session Summary and Final Sync Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use the qskill-executing-plans skill to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.
> Read the current source before each task. This plan describes files and behavior, not implementation code.

**Goal:** Redesign Group Summary so each member sees truthful synchronization status and the current user confirms sync from their own leaderboard row, while preserving both existing completion paths.

**Architecture:** Keep the current Group Summary callbacks and data contracts. Use room member acknowledgment timestamps for member statuses, the existing local `isSyncing` state only for the current user's operation, and the room's authoritative pending count for Host override eligibility. Reuse existing glass, ranking, formatting, avatar loading, and theme patterns without changing shared app chrome.

**Tech Stack:** React Native, TypeScript, Expo, `GlassCard`, `expo-image`, Firebase JS SDK, Jest.

**Spec:** `prompts/redesign-group-session-summary-sync.prompt.md`; accepted reference: `design/references/screenshots/16-group-session-summary-sync-redesign-v1.png`; current behavior: ADR-017 and ADR-018.

**Plan slug:** `2026-11-11-group-session-summary-sync-redesign` — every commit for this work stream would use this slug. No commit is included in this execution because the prompt explicitly says not to commit.

## Global Constraints

- Scope application changes to Group Summary and its focused tests.
- Preserve Header, BottomNav, the app shell, navigation callbacks, and existing Firebase/SQLite contracts.
- The normal completion path remains: every member syncs and acknowledges; the last acknowledgment finalizes the room as `ALL_SYNCED`.
- Preserve the Host's separately confirmed `Finalize anyway` path while reconciliation is pending; it remains available only to the Host and keeps the exact existing warning.
- Peer status uses acknowledgment data only: `Waiting to sync` or `Synced`. Do not infer a peer's `Syncing…` state.
- Use `pendingMemberCount` as the authoritative room count. Do not infer it from the visible roster for status claims or to enable Host override.
- Preserve canonical score/rank, lift and duration values, local outbox behavior, bill/payment gates, History, and return-home actions.
- Reuse existing components and semantic theme values. Do not change dependencies, backend behavior, Rules, schemas, or shared components.
- Do not copy illustrative names, counts, scores, dates, or statuses from the image into application code.
- Keep controls accessible, actions at least 44 dp tall, long member names readable, and the full roster reachable by scrolling.
- Design Read: ENERGY 2 / RHYTHM 2 / MOTION 1. Use the accepted Liquid Acrylic visual language sparingly to distinguish summary, member results, and Host-only action without adding decorative effects without purpose.

---

## Source Findings

- `src/screens/GroupSummaryScreen.tsx` currently renders the current user's sync action in a standalone card, then renders ranked members as separate `GlassCard` rows without avatars or per-member sync status.
- The screen already receives `isOnline`, `isSyncing`, `errorMessage`, the existing callbacks, and a completed `RoomLobbySnapshot`; no caller change is needed to move the action into a member row.
- `src/features/rooms/room-listener.ts` provides each member's `avatarUri` and `syncAcknowledgedAtUtcMs`, plus the authoritative room `pendingMemberCount`. It has no field representing a peer's in-progress sync.
- `src/app/index.tsx` performs the existing local cutoff reconciliation, outbox drain, local pending-count check, then online acknowledgment. Keep this order and its error mapping unchanged.
- `room-completion-repository.ts` finalizes as `ALL_SYNCED` atomically with the last member acknowledgment. Its separate Host transaction permits `HOST_OVERRIDE` after warning confirmation.
- `rankGroupMembers` filters to `ACTIVE` members. ADR-017 still requires `EARLY_EXIT` members to drain eligible data and acknowledge after room completion. Extend this helper with an explicit eligible-status argument whose default remains `ACTIVE`, then have Summary rank both `ACTIVE` and `EARLY_EXIT` members using the same score ordering and UID tie break.
- Avatar rendering/fallback patterns exist privately in `RoomRoster.tsx` and `GroupHomeDashboard.tsx`; they are not exported shared components. Reuse their `expo-image` loading and initials-fallback behavior locally in Group Summary rather than changing shared components.
- `GlassCard`, `rankGroupMembers`, `formatTime`, `Colors`, `Header`, and `BottomNav` already exist. Keep app-shell chrome untouched.
- Current UI falls back to visible pending-member length when the server pending count is missing. The redesign will show an updating/unknown state and keep Host override unavailable until the authoritative count is present and matches the observed pending roster.

## Role and State Matrix

| Role / state | Required UI behavior |
|---|---|
| Current member, acknowledgment pending, online | Show `Sync & confirm` only in the current member's leaderboard row. |
| Current member's sync action running | Show `Syncing…` and a spinner in that row; prevent duplicate taps. |
| Current member, offline | Keep the action disabled and show the existing reconnect guidance in the row. |
| Current member, local outbox or acknowledgment error | Keep the score visible and show the existing error inline in that row; retry uses the existing callback. |
| Current member acknowledged | Show `Synced`; do not show the sync action. |
| Current member is `EARLY_EXIT` and has not acknowledged | Keep the member in the completed-room leaderboard and show their in-row sync action; the existing callback applies the early-exit cutoff. |
| Peer without acknowledgment | Show `Waiting to sync` while reconciliation is pending. |
| Peer with acknowledgment | Show `Synced`. |
| Peer acknowledged data is unavailable in the snapshot | Do not invent an in-progress state; use the existing missing/unknown snapshot fallback only if the source actually distinguishes it. |
| Room pending, Host, authoritative count present and equal to pending roster size | Show the separate Host action with the exact existing confirmation and warning. |
| Room pending, pending count absent or roster/count mismatch | Explain that the room list is updating; do not show or enable `Finalize anyway`. |
| Room pending, non-Host | Do not render Host override controls. |
| `FINALIZED / ALL_SYNCED` | Distinguish all-member completion, show member `Synced` states, hide sync and override actions; preserve bill/history/navigation actions. |
| `FINALIZED / HOST_OVERRIDE` | Explain that the Host finalized before all members synced; identify unacknowledged members as not synced at finalization and keep existing final-score/payment caveat. |
| Host override offline/loading/error | Preserve disabled, busy, and error behavior; do not imply the request succeeded until the existing operation completes. |
| Long name, missing/broken avatar, narrow device, long roster | Fall back to initials, avoid horizontal clipping, retain touch targets, and allow scrolling above the fixed navigation. |
| User is absent from the room roster | Do not render a personal sync action; retain the existing summary and other available actions. |

---

## File Responsibilities

- Modify `src/features/rooms/group-active-domain.ts`: allow callers to select eligible leaderboard statuses while retaining the current `ACTIVE`-only default and sort order.
- Modify `src/screens/GroupSummaryScreen.tsx`: summary hierarchy, leaderboard surface/rows, avatar fallback, per-member status, current-user action placement, Host-only action placement, and safe authoritative-count gating.
- Create `__tests__/group-summary-screen.test.tsx`: focused rendering and interaction coverage for the screen states in this plan.
- Extend `__tests__/group-active.test.ts`: verify the default remains ACTIVE-only and Summary eligibility can include EARLY_EXIT without changing score/UID ordering.
- Read but do not modify `src/app/index.tsx`, `src/features/rooms/room-listener.ts`, `src/features/rooms/group-violation-repository.ts`, and `src/features/rooms/room-completion-repository.ts`.
- Keep `src/components/Header.tsx`, `src/components/BottomNav.tsx`, `src/components/GlassCard.tsx`, and global theme files unchanged.

## Task 1: Cover Group Summary UI states

**Files:** Create `__tests__/group-summary-screen.test.tsx`; modify `__tests__/group-active.test.ts`; read `src/screens/GroupSummaryScreen.tsx` and existing React Native screen-test conventions.

- [x] **Step 1: Add a screen test harness using the repository's existing React Native testing setup.** Mock only native visual dependencies as required by existing conventions; provide room/member data through the real component props.
- [x] **Step 2: Cover own-row sync behavior.** Cases: pending online member sees one in-row CTA; pending offline member sees disabled CTA and reconnect guidance; active local sync shows `Syncing…`; acknowledgment error remains visible in that row; acknowledged member sees `Synced` and no CTA.
- [x] **Step 3: Cover peer statuses and data integrity.** Cases: missing peer acknowledgment shows `Waiting to sync`; acknowledgment timestamp shows `Synced`; peer never shows `Syncing…`; avatar URI uses image presentation and missing/broken URI falls back to initials; ranking, score, lifts, and duration still come from the existing domain data; an `EARLY_EXIT` current member remains present and can acknowledge.
- [x] **Step 4: Extend the ranking-domain test.** Verify `rankGroupMembers` stays ACTIVE-only by default and includes `EARLY_EXIT` only when the caller explicitly requests that eligible state; verify the existing score and UID tie order is unchanged.
- [x] **Step 5: Cover Host safeguards and completion outcomes.** Cases: Host sees the override action only while pending count is positive and equals the observed pending roster; non-Host never sees it; absent count or roster mismatch blocks it; confirmation retains the existing warning; `ALL_SYNCED` and `HOST_OVERRIDE` render distinct completion copy.
- [x] **Step 6: Run the focused screen and ranking tests.** Run `pnpm test -- --runInBand __tests__/group-summary-screen.test.tsx __tests__/group-active.test.ts`.

## Task 2: Redesign summary and leaderboard

**Files:** Modify `src/screens/GroupSummaryScreen.tsx`; run `__tests__/group-summary-screen.test.tsx`.

- [x] **Step 1: Keep the completion summary compact.** Retain completed status, room end time, authoritative pending count when available, and the explanation that settlement remains locked until all members acknowledge or the Host uses the override.
- [x] **Step 2: Extend and use the existing ranking helper.** Add an optional eligible-status list to `rankGroupMembers`, defaulting to `ACTIVE` so its current callers do not change behavior. Pass `ACTIVE` and `EARLY_EXIT` from Group Summary so both can participate in final sync; preserve its score ordering and UID tie break. Keep canonical values. Use separators between member rows instead of stacking a separate glass card for every row.
- [x] **Step 3: Add a local member avatar presentation.** Display a member's actual `avatarUri` with the same `expo-image` caching/error fallback pattern already used by room components; use initials derived from the actual display name if no image is available. Never use the sample avatars from the reference as app data.
- [x] **Step 4: Put a truthful sync status beside each member.** Use acknowledgment timestamp for `Waiting to sync` or `Synced`; use a distinct not-synced-at-finalization explanation after `HOST_OVERRIDE`. Do not introduce peer-level `Syncing…` copy.
- [x] **Step 5: Move only the current user's existing sync action into that user's row.** Keep the current `onSyncAndAcknowledge` callback and its disabled/offline/busy/error semantics, including for an `EARLY_EXIT` member whose existing callback applies the approved cutoff. Show `Syncing…` only while the existing local `isSyncing` prop is true. Remove the standalone sync card so there is one sync entry point.
- [x] **Step 6: Use only the room's authoritative pending count.** If it is absent, show a truthful updating state rather than a roster-derived number. Do not enable override based on a display-only inferred count.
- [x] **Step 7: Keep existing bill, payment details, History, and return-home UI/actions intact.** Preserve their render conditions and callbacks.
- [x] **Step 8: Re-run the focused screen tests.** Confirm row action placement, state rendering, score content, fallback, and no duplicate standalone CTA.

## Task 3: Preserve Host override as a separate guarded action

**Files:** Modify `src/screens/GroupSummaryScreen.tsx`; exercise existing `__tests__/room-host-finalization-override.test.ts` without changing repository behavior.

- [x] **Step 1: Place pending Host override in a distinct Host-only section after the member results.** Keep the warning exact: `Some Members have not synced. Late violations will not affect payment.`
- [x] **Step 2: Require a usable authoritative pending count and matching observed pending roster before offering the action.** When the count is absent or differs from the roster, show an updating/mismatch explanation and withhold the button.
- [x] **Step 3: Preserve confirmation, loading, offline, and error behavior.** Continue using the existing callback and `Alert` confirmation; do not alter the room completion repository or Rules.
- [x] **Step 4: Keep finalized Host override explanation separate from ordinary all-synced completion.** Do not claim the Host-observed UID list is server-verified.
- [x] **Step 5: Run the focused screen test and existing Host override test.** Run `pnpm test -- --runInBand __tests__/group-summary-screen.test.tsx __tests__/room-host-finalization-override.test.ts`.

## Task 4: Final verification and review

**Files:** Review all changes in this plan.

- [ ] Run `pnpm exec tsc --noEmit`.
- [ ] Run `pnpm run lint`.
- [x] Run the focused tests: `pnpm test -- --runInBand __tests__/group-summary-screen.test.tsx __tests__/group-active.test.ts __tests__/room-host-finalization-override.test.ts __tests__/room-listener.test.ts`.
- [ ] Inspect actual Android and iOS Group Summary states where devices are available: own sync pending/running/error, peer waiting/synced, Host override pending, count/roster mismatch, `ALL_SYNCED`, `HOST_OVERRIDE`, long names/rosters, and scrolling above BottomNav.
- [x] Report the actual platforms/devices inspected and list anything that could not be verified. Do not claim a platform passed without observing it.
- [x] Do not commit, push, or deploy.

## Approval Record

- The human approved this plan in the execution conversation on 2026-11-12.
- The human confirmed that both current completion paths are intended: the last member acknowledgment finalizes as `ALL_SYNCED`, or the Host may explicitly finalize early through the existing warning-protected `HOST_OVERRIDE` path.
- The human approved truthful peer statuses only; no new peer-syncing field or Firebase contract is included.
- Implementation review confirmed `rankGroupMembers` excluded `EARLY_EXIT`; the approved plan was updated to add an explicit eligible-status argument with the existing ACTIVE-only default unchanged, so Summary can preserve early-exit members' acknowledgment access.

## Execution Results (2026-11-12)

- Focused tests passed: 4 suites, 20 tests (group-summary-screen, group-active, Host finalization override, room listener).
- Targeted ESLint passed for the changed screen, domain helper, and tests with no diagnostics.
- Repository TypeScript check was run and remains blocked by errors in untouched files: profile test renderer typings, app index/native feedback and StatusBar typing, Header refs, theme hook, BillAllocation/History image fallback typing, and JoinRoom TextInput refs. No TypeScript errors remain in the changed Group Summary files.
- Repository lint was run and remains blocked by 45 diagnostics in other files. No lint errors remain in the changed files; the temporary ESLint config that Expo generated during lint setup was removed.
- No Android emulator/device was available through adb; iOS runtime was not available. Device rendering remains unverified.
- No commit, push, or deploy was performed.

### UI polish follow-up (2026-11-12)

- The current member's Sync & confirm action replaces their pending status; it uses a blue pill and resolves to Synced when the existing acknowledgment snapshot updates.
- Rank numbers now overlap avatar lower corners. Sync errors use a full-width tinted row panel, pending Host actions no longer repeat member names, the summary card has a 12 dp top gap, and the summary scroll area has 150 dp plus safe-area bottom clearance.
- Follow-up focused tests passed (20 tests); ESLint passed on GroupSummaryScreen and its screen tests. Repo-wide TypeScript/lint limitations above remain unchanged.


- Screenshot follow-up reduced glass surfaces to plain summary copy plus one opaque white leaderboard card, moved Host actions into that card's footer, and replaced callback Pressable styles with static style arrays after the screenshot showed their text rendered without backgrounds/borders. Added a regression assertion that the sync action is blue and the Host action has its warning surface.


- Layout follow-up from device screenshot: rank badge is now anchored at the avatar's lower-right corner; member identity/score remain in a compact row while the current member's sync action and full-width error render below it; waiting uses warning color; leaderboard metadata is more legible; Group Summary bottom scroll clearance is 220 dp plus safe-area inset.

