# Group History Redesign Implementation Plan

> **For agentic workers:** Use the `qskill-executing-plans` skill and execute the tasks in order. The user approved this plan in chat. Read the current files before changing them. Keep the implementation limited to Group History and its payment presentation; do not restyle shared app chrome.

**Goal:** Redesign the Group History list and session detail from the checked-in references, prevent repeated History reloads, and make payment confirmation states truthful and stable.

**Architecture:** Keep the existing local-first repository and in-screen list/detail flow. Coordinate History refreshes at the screen level; retain Firebase listeners and their payment authority. Reuse existing screen primitives and theme tokens, adding no app-wide component changes.

**Tech Stack:** React Native 0.88, Expo 58, TypeScript, Firebase JS SDK, SQLite, `FlatList`, Expo Network.

**Spec:** `docs/superpowers/specs/2026-11-04-shared-group-history-design.md`; ADR-023, ADR-024, ADR-028; approved references at `design/references/screenshots/11-group-history-list-redesign.png` and `design/references/screenshots/12-group-history-detail-redesign.png`.

**Plan slug:** `2026-11-08-group-history-redesign`.

## Global Constraints

- Keep changes limited to Group History, its detail/payment presentation, and directly related tests.
- Do not redesign other tabs or broadly restyle `Header`, `BottomNav`, `AppBackground`, `PrimaryButton`, or `GlassCard`.
- Reuse suitable existing components, hooks, formatters, and tokens first. Extract a component only for a repeated in-scope pattern when no existing component fits.
- Add no dependency, schema, Firebase query, API, backend function, payment contract, or bank-detail/QR cache.
- Preserve `initialRoomId`, pagination, access boundaries, score/bill authority, and payment listener checks.
- Keep local/session score separate from canonical room score; keep cached data distinct from server-confirmed data.
- Preserve safe areas, `FlatList`, accessible labels, and touch targets of at least 48 dp across both platforms.
- Do not commit or push unless the user explicitly asks.

---

### Task 1: Coordinate History refresh and freshness state

**Files:**
- Modify: `src/screens/GroupHistoryScreen.tsx`
- Create: `src/features/history/group-history-refresh-policy.ts`
- Create: `__tests__/group-history-refresh-policy.test.ts`
- Modify: `__tests__/group-history-screen.test.tsx`

- [ ] Add a focused policy test for network edges: only offline-to-online returns a reconnect refresh; same-state callbacks and an unknown initial state do not trigger a second initial refresh.
- [ ] Run `pnpm test -- --runInBand __tests__/group-history-refresh-policy.test.ts` and confirm the new policy test fails before implementation.
- [ ] Update `GroupHistoryScreen` so mount performs one local-first load and one cloud refresh only when online; offline mount reads local data and skips `syncPending`.
- [ ] Track the last observed connectivity state and refresh only on an offline-to-online edge. Remove History list refresh from the app foreground listener; keep payment's own foreground revalidation so stale QR data is discarded.
- [ ] Keep one list refresh per user action. Pull-to-refresh or retry must not also invoke a second detail refresh; returning from payment refreshes the selected detail once without reloading the list.
- [ ] Separate first-load state from background refresh state. Preserve visible list/detail content and allow payment navigation while the list is refreshing.
- [ ] Keep the newest request authoritative. Ignore responses from older requests; merge older-page results with current items and advance the pagination cursor only from the accepted response.
- [ ] Model detail source/check state explicitly. Show cached detail immediately, keep its existing source label while a live read is pending, mark it Firebase-confirmed only after a successful server read, and retain the visible copy with an error/retry state on failure.
- [ ] Extend screen tests for offline/no-sync, online/local-first, duplicate network callbacks, reconnect, no foreground reload, retained content during manual refresh, stale response handling, pagination, `initialRoomId`, and back navigation.
- [ ] Run `pnpm test -- --runInBand __tests__/group-history-screen.test.tsx` when dependencies permit. `react-test-renderer` is currently absent from `node_modules`; do not add a dependency. If blocked, record the exact module-resolution error and run the pure policy tests.

### Task 2: Redesign the Group History list and detail

**Files:**
- Modify: `src/screens/GroupHistoryScreen.tsx`
- Modify: `__tests__/group-history-screen.test.tsx`

- [ ] Inventory and reuse the existing `GlassCard`, `PrimaryButton`, `formatTime`, `formatVND`, theme tokens, and Group Home session hierarchy. Do not extract the private Group Home row or change Group Home UI.
- [ ] Build the list hierarchy from the reference: concise Group History summary, loaded/saved-session count without implying an unseen total when more pages exist, one clear manual update action, then recent session rows.
- [ ] Make each row scan quickly: consistently formatted date/time, completion state, source, duration, lift count, and an explicit point scope (`room pts` or `local pts`). Use only actual repository data.
- [ ] Arrange detail as personal/local result first, room result and bill state second, the signed-in member's own share with its payment action third, and the roster last.
- [ ] Mark the current member as `You` and show their actual share next to the payment action when available. Label personal/local points separately from canonical room points.
- [ ] Keep cache, checking, Firebase-confirmed, offline, and error states distinct. Never label cached bill data as live. Preserve Host override and excluded-late-violation explanations.
- [ ] Keep existing back-to-Group/back-to-history flow. Use a single clear back action within the screen, preserve `initialRoomId`, and avoid changing the global header or bottom navigation.
- [ ] Add safe-area/bottom-tab clearance in this screen only, without changing the global navigation component. Keep the dynamic list virtualized with `FlatList`.
- [ ] Add/adjust screen assertions for row content and score scope, detail ordering, current-member share, distinct freshness states, empty/error/offline states, touch target/accessibility labels, and selection/back behavior.
- [ ] Re-run the focused screen test where possible; record the missing `react-test-renderer` limitation if it still prevents the suite from starting.

### Task 3: Stabilize Pay my share confirmation presentation

**Files:**
- Modify only if needed: `src/screens/HistoryPaymentScreen.tsx`
- Modify: `src/screens/VietQRSettlementScreen.tsx`
- Modify: `__tests__/group-history-payment.test.ts`
- Modify: `__tests__/payment-details-listener.test.ts`

- [ ] Preserve `listenToHistoryPayment`, `buildVietQrPayment`, Firebase server-source requirements, and all current membership/bill/revision/paid-counter/payment-details checks.
- [ ] Present one stable pending confirmation state while bill and settlement-detail listeners are loading. Do not show a refresh/reload CTA at the same time as the pending indicator.
- [ ] Offer manual retry only for an unavailable/error state; show a clear offline reason and do not expose a QR or bank details while offline.
- [ ] Ensure retry clears the old listener result/QR before starting exactly one new confirmation attempt.
- [ ] On payment return, perform one selected-detail reread and retain the visible result while it runs; do not refresh the whole History list.
- [ ] Cover matching server data, mismatched revision/counter, offline, invalid membership, listener error, missing/expired details, stale-QR invalidation on retry, and return-to-detail refresh count.
- [ ] Run `pnpm test -- --runInBand __tests__/group-history-payment.test.ts __tests__/payment-details-listener.test.ts`.

### Task 4: Final verification and scope review

**Files:** all files changed in Tasks 1–3.

- [ ] Run the focused History and payment test commands. Do not add dependencies to enable the existing component test.
- [ ] Run `pnpm exec tsc --noEmit`, `pnpm run lint`, and `git diff --check`; separate pre-existing repository failures from regressions in changed files.
- [ ] If a simulator/device is available, inspect populated and empty list, offline cache, cloud error, Host override detail, long roster, payment pending, valid QR, unavailable payment, and retry on both iOS and Android. Report only platforms actually inspected.
- [ ] Check small-screen width, large text, safe-area/tab-bar clearance, accessible names, and at least 48 dp touch targets.
- [ ] Confirm the final diff contains only the approved Group History screens and focused tests; existing reference PNGs and prompt are user-created untracked artifacts and must be preserved.
- [ ] Report verification blockers accurately. Known environment risks: `react-test-renderer` is absent; prior full-suite checks also encountered unrelated baseline failures, and device previews were unavailable.

## Known Baseline and Plan Notes

- Current `GroupHistoryScreen` refreshes on mount, every network callback, app foreground, and pull-to-refresh. Pull-to-refresh also requests detail refresh while the list refresh path can request it again.
- The current detail freshness UI has only a `detailLive` boolean and can replace visible detail with a null cache result while checking.
- The current payment screen can display its refresh action while listeners are still loading because that state is classified as unavailable.
- The visual references are light-theme mockups. This plan does not add a new dark-mode system or change the app-wide shell.
- The UI/UX skill's local search script/Python launcher was unavailable in this environment; visual decisions use the accepted design docs, current tokens/components, and the checked-in references.
