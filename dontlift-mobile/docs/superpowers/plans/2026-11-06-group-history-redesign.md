# Group History Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use the qskill-executing-plans skill to implement this plan task-by-task. Steps use checkbox syntax for tracking. Read the real files before each task.

**Goal:** Redesign Group History list/detail and eliminate repeated history/payment refreshes while preserving Firebase authority and offline history.

**Architecture:** Keep the existing in-screen list/detail flow and repository contracts. Load SQLite first, refresh cloud only on initial entry, explicit user refresh, or an offline-to-online transition. Payment remains listener-driven and exposes a QR only after current room, membership, bill, revision, paid counter, and settlement details agree.

**Tech Stack:** React Native 0.88, Expo 58, TypeScript, FlatList, Firebase JS SDK, Expo Network.

**Spec:** `docs/superpowers/specs/2026-11-04-shared-group-history-design.md`; ADR-023, ADR-024, ADR-028; approved UI and refresh decisions in the user-approved chat plan.

**Plan slug:** `2026-11-06-group-history-redesign` — every commit starts with `[2026-11-06-group-history-redesign]`.

## Global Constraints

- Use the same behavior on iOS and Android.
- Use tokens from `src/constants/theme.ts`; add no dependency and change no payment data contract.
- Show cached history immediately; refresh cloud on initial entry, explicit user refresh, or offline-to-online transition.
- Do not refresh History on foreground transitions or repeated network callbacks.
- Never cache or display bank details or QR from cache.
- Follow system theme across Group History chrome, content, navigation, and status bar.
- Preserve `initialRoomId`, pagination, personal/shared score distinctions, and existing access boundaries.
- Design dials: ENERGY 2 / RHYTHM 2 / MOTION 1. Use restrained Liquid Acrylic surfaces and readable data hierarchy.

---

### Task 1: Stabilize History loading and freshness state

**Files:** `src/screens/GroupHistoryScreen.tsx`, `__tests__/group-history-screen.test.tsx`

- [ ] Add tests: offline mount reads cache without sync; online mount reads local then cloud once; duplicate network callbacks do not refresh; offline-to-online refreshes once; foreground does not refresh; manual refresh retains visible content; pagination merges rows and advances cursor; stale request cannot overwrite newer state.
- [ ] Run `pnpm test -- --runInBand __tests__/group-history-screen.test.tsx` and confirm the new policy tests fail for the expected behavior.
- [ ] Keep the local-first read. Trigger cloud refresh only on initial entry, user refresh, or network transition from offline to online. Do not trigger list and detail refresh twice for one action.
- [ ] Keep existing rows visible during refresh. Separate first-load state from refresh state so refresh does not disable payment or replace the page with a spinner.
- [ ] Model detail freshness so cached data remains labeled `Saved copy` while a live check is pending; change to `Confirmed from Firebase` only after a server read succeeds. On failure, retain cache and expose retry.
- [ ] Rerun the focused History screen tests and confirm selection, `initialRoomId`, back navigation, and pagination remain intact.
- [ ] Commit as `[2026-11-06-group-history-redesign] Stabilize Group History refresh policy` with Plan and Task trailers.

### Task 2: Redesign History/detail and system theme

**Files:** `src/screens/GroupHistoryScreen.tsx`, `src/app/index.tsx`, `src/components/AppBackground.tsx`, `src/components/Header.tsx`, `src/components/BottomNav.tsx`, `src/components/GlassCard.tsx`, `src/components/PrimaryButton.tsx`, `__tests__/group-history-screen.test.tsx`

- [ ] Add tests: personal and shared scores have distinct labels; rows present date/time, duration, lifts, score, and source; detail order is personal result, room result/bill/my share, then roster; empty/offline/cache/error/loading states are distinct; light/dark tokens apply to History chrome/content/status bar; interactive rows and controls expose accessible labels and at least 44dp targets.
- [ ] Run the focused History test and confirm the new assertions fail before changing production code.
- [ ] Match the Group Home recent-session hierarchy for History rows, using existing data and tokens. Do not invent member previews or avatars.
- [ ] Arrange detail around the member's own result first, shared finalization/bill state second, personal payment action alongside the member's share, and roster last. Preserve Host override and excluded-late-violation explanations.
- [ ] Select the system palette only while `currentScreen === '15-group-history'`; pass it through the app background, header, cards, buttons, bottom navigation, and status bar. Keep other screens on current behavior.
- [ ] Keep dynamic content in `FlatList`, respect safe areas, avoid horizontal overflow, and keep accessible touch targets. Data panels use readable solid surfaces; retain glass as a limited Group chrome accent.
- [ ] Rerun the focused History test for both palette modes, content hierarchy, and existing navigation.
- [ ] Commit as `[2026-11-06-group-history-redesign] Redesign Group History for both themes` with Plan and Task trailers.

### Task 3: Stabilize Pay my share confirmation

**Files:** `src/screens/GroupHistoryScreen.tsx`, `src/screens/HistoryPaymentScreen.tsx`, `src/screens/VietQRSettlementScreen.tsx`, `__tests__/group-history-payment.test.ts`, `__tests__/payment-details-listener.test.ts`

- [ ] Add tests: current matching room/member/bill/details shows QR; mismatched revision or paid counter withholds QR; offline, invalid membership, error, missing or expired details withholds QR; retry starts one fresh subscription and clears stale QR; closing payment performs one detail reread without clearing visible data.
- [ ] Run `pnpm test -- --runInBand __tests__/group-history-payment.test.ts __tests__/payment-details-listener.test.ts` and confirm the new assertions fail for expected behavior.
- [ ] Keep payment listener authority and `buildVietQrPayment` checks unchanged. Present a single clear pending confirmation state, with manual retry only for unavailable/error.
- [ ] Never expose cached bank details or cached QR. A detail cache label applies only to History results, not payment recipient information.
- [ ] On return from payment, refresh the selected detail once; do not refresh the entire list or reset freshness labels while the read is pending.
- [ ] Rerun both focused payment suites and confirm no stale QR is visible after network/revision changes.
- [ ] Commit as `[2026-11-06-group-history-redesign] Clarify current payment confirmation state` with Plan and Task trailers.

### Task 4: Final verification

**Files:** all files changed in Tasks 1–3.

- [ ] Run `pnpm exec tsc --noEmit` and `pnpm run lint`.
- [ ] Run the focused suites from Tasks 1–3, then `pnpm test -- --runInBand`.
- [ ] Inspect Group History in light and dark themes on iOS and Android where available: populated/empty list, offline cache, cloud error, Host override detail, long roster, payment confirmation, valid QR, unavailable payment, and retry.
- [ ] Click through list selection, back navigation, pull-to-refresh, reconnect, payment open/return, retry, and pagination; confirm no repeated refreshes or source-label flicker.
- [ ] Record the actual device/platform evidence and any unverified platform behavior before reporting completion.

## Assumptions

- User-facing copy stays in English to match existing Group screens.
- Detail remains inside `GroupHistoryScreen`; `initialRoomId` continues to open the intended room.
- Scoring, bill calculation, authorization, and Firebase query boundaries do not change.
