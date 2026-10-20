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
