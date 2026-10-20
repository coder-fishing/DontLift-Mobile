# Review feedback — SL-018 early exit

## RC-001

- **Status:** RESOLVED
- **Severity:** Medium
- **Category:** Idempotency
- **Location:** `src/features/rooms/early-exit-repository.ts` — `decideEarlyExit`
- **Problem:** A retry of a committed Host decision was rejected when the room or Host had since become inactive, because live-state checks ran before the saved terminal request was examined.
- **Recommendation:** Verify the caller is still the room's Host, then replay the same committed request ID and decision before requiring an ACTIVE room and Host.
- **Created At:** 2026-10-20
- **Updated By:** Codex
- **Updated At:** 2026-10-20
- **Response:** Moved terminal replay before ACTIVE-state checks while retaining room ownership and Host-role validation. Added a repository regression test for matching and conflicting decisions after room completion. Added a narrow Firestore Rules `get` permission for the Host of a terminal room so the transaction can read the committed request; list access remains limited to current room participants. Added an Emulator regression for replay after the room is COMPLETED and the Host membership is INACTIVE.

## RC-002

- **Status:** RESOLVED
- **Severity:** Medium
- **Category:** User confirmation
- **Location:** `src/screens/GroupActiveScreen.tsx` — Member early-exit action
- **Problem:** Pressing the action immediately created an OPEN request without the confirmation required by the product design.
- **Recommendation:** Ask the Member to confirm that their score will freeze before sending the request.
- **Created At:** 2026-10-20
- **Updated By:** Codex
- **Updated At:** 2026-10-20
- **Response:** Added a native confirmation alert with the required score-freeze explanation and Cancel/Request actions. The command runs only from Request. Added a UI test that verifies the alert, cancellation, and confirmed submission.

**Execution record — 2026-10-20, review feedback batch:** `pnpm exec jest --runInBand __tests__/early-exit-repository.test.ts __tests__/group-active-screen.test.tsx` passed (2 suites, 7 tests). `pnpm exec tsc --noEmit`, `node --check functions/tests/early-exit-rules.emulator.test.cjs`, and `git diff --check` passed. The Firestore Rules Emulator regression was added but not run; Java is unavailable in this environment. No billing or Cloud Rules deployment was performed.

## RC-003

- **Status:** RESOLVED
- **Severity:** Medium
- **Category:** Retry lifecycle
- **Location:** `src/app/index.tsx` — early-exit cleanup and eligible violation sync
- **Problem:** A transient sync failure after Host approval could strand eligible pending violations because the active capture effect had already stopped and no retry trigger remained.
- **Recommendation:** Keep a retry trigger alive for exited members until eligible outbox rows drain.
- **Created At:** 2026-10-20
- **Updated By:** Codex
- **Updated At:** 2026-10-20
- **Response:** Added an independent network-aware retry controller that runs every five seconds while connected, retries transient errors and pending outbox rows, and stops when the outbox drains. It hands pending rows to SL-020 when a terminal-room precondition is detected. Added unit tests for transient retry/drain and terminal reconciliation behavior.

## RC-004

- **Status:** RESOLVED
- **Severity:** Medium
- **Category:** UI feedback
- **Location:** `src/screens/GroupActiveScreen.tsx` — Host decision buttons
- **Problem:** The pending indicator always appeared beside Approve, even when the Host had selected Deny.
- **Recommendation:** Show progress on the decision that is currently being submitted.
- **Created At:** 2026-10-20
- **Updated By:** Codex
- **Updated At:** 2026-10-20
- **Response:** Changed the pending state to carry both request ID and decision. The indicator now appears only on the selected Approve or Deny action; added a UI regression test for a pending denial.

**Execution record — 2026-10-20, second review feedback batch:** `pnpm exec jest --runInBand __tests__/early-exit-sync-retry.test.ts __tests__/group-active-screen.test.tsx __tests__/early-exit-repository.test.ts` passed (3 suites, 10 tests). `pnpm exec tsc --noEmit` and `git diff --check` passed. Physical online/offline Expo Go behavior remains unverified.

## RC-005

- **Status:** RESOLVED
- **Severity:** High
- **Category:** Capture shutdown ordering
- **Location:** `src/app/index.tsx` — ACTIVE capture cleanup and EARLY_EXIT cutoff finalization
- **Problem:** An in-flight foreground drain or lifecycle recovery could finish writing a confirmed violation after cutoff finalization had already queried open local rows. The new sync retry only drains ended outbox rows and could not close that late open row.
- **Recommendation:** Await queued capture/lifecycle work before cutoff finalization, or finalize again after it drains.
- **Created At:** 2026-10-20
- **Updated By:** Codex
- **Updated At:** 2026-10-20
- **Response:** Added a per-room work tracker for drain, initialization and lifecycle operations. The capture effect registers its tracker; on EARLY_EXIT, cutoff finalization first waits for tracked work to settle, then closes all remaining confirmed rows and starts the existing outbox retry. Added a focused tracker test proving that shutdown waits for current work and nested recovery work queued during drain.

**Execution record — 2026-10-20, third review feedback batch:** `pnpm exec jest --runInBand __tests__/group-capture-work.test.ts __tests__/early-exit-sync-retry.test.ts __tests__/group-active-screen.test.tsx __tests__/early-exit-repository.test.ts __tests__/group-violation-repository.test.ts __tests__/room-lobby-projection.test.ts` passed (6 suites, 17 tests). `pnpm exec tsc --noEmit` and `git diff --check` passed. Expo Go cutoff-race behavior remains unverified on device.

## RC-006

- **Status:** RESOLVED
- **Severity:** Medium
- **Category:** Retry lifecycle
- **Location:** `src/app/index.tsx` — early-exit local cleanup failure path
- **Problem:** A transient SQLite failure in `finalizeOpenAtRoomEnd` or `persistEarlyExitProjection` removed the in-flight guard but did not retrigger the effect, leaving local state unfinished until restart or an unrelated room snapshot.
- **Recommendation:** Schedule another cleanup attempt or add a retry trigger.
- **Created At:** 2026-10-20
- **Updated By:** Codex
- **Updated At:** 2026-10-20
- **Response:** Added a cleanup retry controller with capped exponential backoff and an immediate retry trigger on reconnect. It retries the idempotent cutoff finalization and local projection before starting outbox sync. The in-flight guard is released if the effect is disposed before cleanup succeeds. Added unit tests for transient failure and reconnect-triggered retry.

**Execution record — 2026-10-20, fourth review feedback batch:** `pnpm exec jest --runInBand __tests__/early-exit-cleanup-retry.test.ts __tests__/group-capture-work.test.ts __tests__/early-exit-sync-retry.test.ts __tests__/group-active-screen.test.tsx __tests__/early-exit-repository.test.ts __tests__/group-violation-repository.test.ts __tests__/room-lobby-projection.test.ts` passed (7 suites, 19 tests). `pnpm exec tsc --noEmit` and `git diff --check` passed. Local SQLite failure/recovery remains to be exercised on Expo Go.
