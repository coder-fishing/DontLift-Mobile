# Group Actionable Sessions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use the qskill-executing-plans skill to implement this plan task-by-task. Steps use checkbox syntax for tracking.
> This plan specifies observable behaviour and verification, not code. Read the named files before implementation.

**Goal:** Show active sessions and unresolved bill/payment tasks in the Group Home recent-list slot using the existing compact Recent row design. Keep the History button in the same header so users can open the full history list.

**Architecture:** Use one session-list region. When actionable sessions exist, display them there instead of regular Recent rows; when none exist, show the five newest regular Recent rows. The History button stays in the list header in both states. Action items use the current compact Recent row hierarchy, including a roster avatar stack when a real recent-session preview is already available and a neutral existing icon otherwise. Source the actions from the user's known rooms, with role-aware statuses and destinations. Use saved data while offline and label it as saved. Do not cache or display bank details or QR data in Group Home.

**Tech Stack:** React Native, TypeScript, Expo, Firebase JS SDK, SQLite, Jest.

**Spec:** none (bounded task). Latest user decision: use “Needs attention” as the content of the existing Recent list region, styled like Recent rows, and preserve the History button; do not show a second Recent list below it while actions are outstanding.

**Plan slug:** `2026-11-12-group-actionable-sessions` — every commit for this plan starts with `[2026-11-12-group-actionable-sessions]`. Per the user's preference, do not commit without an explicit request.

## Global Constraints

- Keep one session-list region. If actionable items exist, they replace Recent rows in that region; otherwise retain the existing five-entry Recent limit.
- Show no more than five actionable rows at first; “Load more” reveals the next five already-loaded rows before fetching another bounded page.
- Preserve the History button in the shared section header whether the list shows actionable items or Recent history.
- Keep unresolved bill and payment actions visible to non-Premium members beyond the ordinary seven-day history window, until the action is resolved. This extended visibility applies only to actionable work; it does not extend access to ordinary history.
- Reuse existing room, history, bill, and payment data; do not add Firestore collections or change payment contracts.
- Do not show cached bank details, payment details, or QR codes in Group Home.
- Keep the interaction consistent on iOS and Android, with accessible touch targets and labels.
- Never present an offline or cached status as live confirmation.

---

## Files and Responsibilities

- `src/features/history/group-history-repository.ts`: Read known room state and derive the action needed by the current member for each room.
- `src/app/index.tsx`: Load and refresh action items alongside Recent Sessions, and route each action to the existing room, summary, bill, or history flow.
- `src/components/GroupHomeDashboard.tsx`: Display actionable sessions in the Recent row pattern in place of regular Recent entries; use Recent entries as the empty-queue fallback.
- `__tests__/group-home-dashboard.test.tsx`: Verify replacement behavior, the persistent History button, load-more discoverability, and the Recent fallback.
- `__tests__/group-actionable-sessions.test.ts`: Verify actionable room states, role-specific tasks, saved/offline results, and paged loading.
- `__tests__/group-actionable-navigation.test.ts`: Verify the selected room is loaded before opening an active session and that stale actions recover safely.

## Task 1: Find and Load Sessions That Need Action

**Files:** `src/features/history/group-history-repository.ts`, `src/app/index.tsx`, focused repository tests.

- [ ] **Step 1: Add failing repository tests.** Cover these cases:
  - An active membership in a live room -> the room appears as “Resume session”.
  - A finalized room with no published bill and the current member is Host -> the room appears as “Set up bill”.
  - A finalized room with no published bill and the current member is not Host -> the room appears as “Waiting for Host bill”.
  - A published bill with the current member's share not confirmed by the Host -> the room appears as “Awaiting confirmation” with a “Review payment” action.
  - A published bill with one or more shares not confirmed and the current member is Host -> the room appears as “Review payments”.
  - A share already confirmed, or a room with no remaining action for this member -> the room is absent from the action queue.
  - A non-Premium member has an unresolved bill or payment action older than seven days -> it remains in “Needs attention” until resolved, while ordinary history remains subject to its existing seven-day limit.
  - A cancelled or aborted room -> the room is absent from the action queue.
  - A server read fails but saved room data exists -> the cached action may remain visible and is labeled as saved/offline, not confirmed live.
  - The same room is discovered through more than one source -> it appears once.
  - The current account changes during loading -> results for the previous account are discarded.
  - Many known rooms -> room states are read in bounded pages and the first Group Home content remains available while more action candidates load.

- [ ] **Step 2: Run the focused repository tests and confirm the new cases fail.**

Run: `pnpm test -- --runInBand __tests__/group-actionable-sessions.test.ts`

- [ ] **Step 3: Load actionable state for rooms already known to this member.**
  - Use the existing room membership/index sources and current room state; do not search unrelated rooms.
  - Determine the displayed action from the current room status, reconciliation status, bill publication state, member role, and the relevant share confirmation state.
  - Show active sessions before bill setup, then payment review actions; within the same action class, show the most recently updated room first.
  - A Host sees the bill setup action when scores are finalized and no bill is published. Other members see that the Host still needs to publish the bill.
  - A Host sees “Review payments” when a published bill has shares that are not confirmed. The action opens the existing bill allocation flow; it never marks a share as paid automatically.
  - A member whose share is already confirmed does not see a payment action for that share.
  - A member whose share is not confirmed sees “Awaiting confirmation” and “Review payment”. Do not claim the member has not transferred money: the app only knows whether the Host has confirmed receipt.
  - Never infer bill or payment completion from an unavailable server read. Retain a saved state with an explicit saved/offline label, or omit the action when no safe saved state exists.
  - Keep unresolved bill and payment actions discoverable beyond the ordinary seven-day history window for non-Premium members, using existing room and membership sources. Remove an action only after the relevant work is resolved or the room is no longer actionable; do not extend the non-Premium ordinary history window.
  - Read room-index candidates in bounded pages. Render the primary Group Home content without waiting for every known room; continue loading candidates without dropping unresolved actions, and provide a way to load more when more action items remain.
  - Use saved room/action state while offline. Refresh a room's action state when the user opens it or returns to Group Home; do not attach a separate live listener to every action row.

- [ ] **Step 4: Re-run the focused repository tests.**

Run: `pnpm test -- --runInBand __tests__/group-actionable-sessions.test.ts`

Verify all action states, role differences, deduplication, account changes, paged loading, and offline behaviour.

## Task 2: Show the Action Queue and Open the Correct Flow

**Files:** `src/components/GroupHomeDashboard.tsx`, `src/app/index.tsx`, `__tests__/group-home-dashboard.test.tsx`, focused navigation tests.

- [ ] **Step 1: Add failing dashboard and navigation tests.** Cover these cases:
  - When action items exist, the shared list region is titled “Needs attention” and uses the existing Recent row layout; regular Recent rows are not duplicated below it.
  - Show five actionable rows at a time and reveal additional rows in batches of five.
  - While actions are loading with no saved rows available, show a skeleton that follows the Recent row layout; during refresh with existing rows, preserve those rows.
  - The History button remains available in the shared list header.
  - When no action items remain, the shared list region returns to Recent Sessions and shows up to five entries.
  - An active room action opens the existing active-session flow for that room.
  - The Host's “Set up bill” action opens the existing bill allocation flow for that room.
  - The Host's “Review payments” action opens the existing bill allocation flow without changing any share status.
  - A member's “Review payment” action opens that room's existing Group History detail, without automatically opening a QR or claiming the transfer has not been made.
  - “Waiting for Host bill” opens the room summary/detail without offering a Host-only action.
  - Tapping “Resume session” loads the selected room and the current member's membership before opening Group Active.
  - A selected room that is no longer active, has invalid membership, or cannot be loaded -> Group Home stays visible and shows a recoverable message instead of an empty active screen.
  - If the current action page is empty but `hasMore` is true, “Needs attention” stays visible and exposes Load more.
  - Loading, offline, and cloud-error states keep the user on Group Home and never label cached action state as live.
  - Each action control has an accessible label and at least a 44 dp touch target.

- [ ] **Step 2: Run the focused dashboard and navigation tests and confirm the new cases fail.**

Run: `pnpm test -- --runInBand __tests__/group-home-dashboard.test.tsx __tests__/group-actionable-navigation.test.ts`

- [ ] **Step 3: Add the “Needs attention” section.**
  - Each row names the room/session, explains the pending task, and provides one action that opens the existing destination.
  - Keep the History link intact; show the five newest Recent Sessions only when the action queue is empty.
  - A room may appear in both sections while it is recent and still needs action; the action section must not alter the history row's data or status.
  - Use the existing visual tokens and compact Group Home row patterns; do not add mock members or payment data.

- [ ] **Step 4: Route actions by room state and role.**
  - Resume an active room through the existing room restoration and active-session navigation.
  - Open bill setup only for the Host after score finalization.
  - Open the existing Group History detail for a share not confirmed by the Host. The user chooses whether to start a transfer; do not open the QR automatically.
  - Open bill allocation for the Host to review shares not confirmed by the Host; do not mark them paid without the Host's explicit confirmation.
  - For non-Host members with no published bill, open read-only summary/detail and explain that the Host must publish it.
  - If a room changes state before the action is opened, refresh that room once and route according to its current state; show a recoverable message if it is no longer available.

- [ ] **Step 5: Re-run the focused dashboard and navigation tests.**

Run: `pnpm test -- --runInBand __tests__/group-home-dashboard.test.tsx __tests__/group-actionable-navigation.test.ts`

Verify that action routing uses the shared recent-list region, preserves History navigation, and falls back to the five-row Recent list when no action remains.

## Task 3: Final Verification

- [ ] Run `pnpm test -- --runInBand __tests__/group-actionable-sessions.test.ts __tests__/group-actionable-navigation.test.ts __tests__/group-home-dashboard.test.tsx`.
- [ ] Run `pnpm exec tsc --noEmit` and report any existing unrelated failures separately.
- [ ] Run `git diff --check` and confirm the working tree changes are limited to this feature and its tests.
- [ ] Manually verify Group Home with an active room, Host bill setup pending, member bill waiting, unpaid share, all actions complete, offline saved data, and cloud read error. Do not claim device verification for a platform that was not tested.
