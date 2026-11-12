# Premium Pricing Screen Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use the qskill-executing-plans skill to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Read the real files before editing each task.
> This plan is intentionally skeleton-level: it specifies files, observable behavior, and tests, not implementation code.

**Goal:** Replace the old Premium package schedule with the human-approved prices and bonus months, and redesign the existing Premium plan selector to match the checked-in reference while preserving payOS and entitlement behavior.

**Architecture:** The Express API remains authoritative for price, paid months, granted months, orders, and entitlement. The mobile fallback catalog is updated for truthful display when the API is unavailable, but checkout remains disabled until the server catalog is loaded. The Premium screen derives plan copy and the best-value marker from catalog values; existing checkout logic and app-wide chrome remain in place.

**Tech Stack:** Expo 58, React Native 0.88, TypeScript, Firebase JS SDK, external Express Premium API, Jest.

**Spec:** `docs/superpowers/specs/2026-10-23-sl-031-032-payos-premium-design.md` and ADR-025 for existing payment behavior. The package schedule in this plan is a newer human-approved decision and will be recorded in ADR-029.

**Plan slug:** `2026-11-08-premium-pricing-redesign`

## Scope and approved package schedule

| Package ID | Price | Paid months | Granted months | User-facing offer |
|---|---:|---:|---:|---|
| `MONTH_1` | 30,000 VND | 1 | 1 | 1 month; Basic access |
| `MONTH_3` | 79,000 VND | 3 | 4 | 3 months + 1 month free |
| `MONTH_6` | 149,000 VND | 6 | 8 | 6 months + 2 months free |
| `MONTH_12` | 249,000 VND | 12 | 16 | 12 months + 4 months free; Best Value |

The user confirmed the Express server was updated, but its source and live endpoint are unavailable in this workspace. Do not alter or claim to verify server code. Keep the mobile app's server-authoritative catalog requirement and report endpoint verification as not performed.

**Approved behavior update (2026-11-08):** When a current checkout exists, selecting another package automatically begins a package switch after 400 ms without another confirmation button. The debounce applies only before the cancellation request; once cancellation starts, disable package selection. Show a truthful switching skeleton instead of the old QR and create/show a replacement QR only after the server confirms that the old order is terminal. Tapping back to the active package during the debounce cancels the timer and restores the current QR without a server call. This supersedes Task 2's earlier package-switch confirmation behavior; the cancellation and payment safety checks from ADR-025 remain.

## Files and responsibilities

- Modify `src/features/premium/premium-api.ts` to update the display fallback schedule; preserve endpoint validation and the rule that checkout requires the live catalog.
- Modify `src/screens/PremiumScreen.tsx` to display paid duration, total grant/bonus, prices, derived Best Value, and approved card hierarchy, using current semantic tokens and checkout controls.
- Modify `__tests__/premium-screen.test.tsx` and `__tests__/premium-purchase.test.ts` to cover new package values, copy, selection, and unchanged request contract.
- Create `docs/decisions/ADR-029-premium-pricing-update.md` and update current references in `docs/api-contracts.md`, `docs/product-requirements.md`, `docs/product-design.md`, `docs/software-architecture.md`, and `docs/feature-specification.md`. Leave historical ADR-025, the 2026-10-23 spec, and its plan unchanged; ADR-029 supersedes their package schedule only.
- Do not modify `src/app/index.tsx`, shared navigation, payment backend, Firebase Functions, or other screens unless implementation evidence shows a required scoped change; stop and amend the plan before expanding scope.

## Task 1: Record the new package decision and update active docs

**Files:** new `docs/decisions/ADR-029-premium-pricing-update.md`; `docs/api-contracts.md`; `docs/product-requirements.md`; `docs/product-design.md`; `docs/software-architecture.md`; `docs/feature-specification.md`.

- [x] Add ADR-029 with the exact four package IDs, prices, paid months and granted months. State that the server is authoritative and no auto-renewal/payment contract/entitlement rules change.
- [x] Update current document override notes and API pricing summary to refer to ADR-029 and the new schedule.
- [x] Preserve ADR-025 and historical SL-031/032 spec/plan contents as historical records.
- [x] Review all changed docs for conflicting current-price statements; leave historical source text intact where clearly marked as superseded.
- [x] Run `git diff --check` and inspect the doc diff; no whitespace errors found.

## Task 2: Update the mobile plan selector and focused tests

**Files:** `src/features/premium/premium-api.ts`; `src/screens/PremiumScreen.tsx`; `__tests__/premium-screen.test.tsx`; `__tests__/premium-purchase.test.ts`.

- [x] Update the client fallback to 30,000/79,000/149,000 VND with paid/granted month values 1/1, 3/4, 6/8, and 12/16.
- [x] Redesign plan cards to show paid duration and price on one clear row, a truthful bonus treatment for packages with extra months, the resulting usage duration, and an accessible radio state. Match the checked-in visual hierarchy without repeating heavy gradients, glow, or glass on every surface.
- [x] Derive bonus wording and Best Value from catalog fields; pick the lowest price per granted month with a deterministic tie-break. Only show the badge when a catalog package qualifies.
- [x] Default to MONTH_12 when no saved/pending checkout determines the selection, matching the approved reference; preserve restoring any saved pending package and existing user selection behavior.
- [x] Keep the current “one payment, no auto-renewal” message, CTA, pending order status, QR, restore, retry, paid/expiry and error flows. Do not change API request shape or checkout logic.
- [x] Replace the extra package-switch confirmation with a 400 ms debounce when a pending checkout exists. Cancel a scheduled switch if the user selects the active package again before the timer fires; use only the latest selected package when it fires.
- [x] When switching starts, disable package selection, replace/hide the old QR and checkout link with an accessible loading skeleton, and explain that no replacement QR appears until the prior order is confirmed terminal by the server.
- [x] If cancellation fails or is ambiguous, create no new order, keep the previous QR hidden while the target differs, explain that cancellation was not confirmed, and offer a retry/status reconciliation action.
- [x] If the existing order is already PAID, preserve the paid result and do not create a second order.
- [x] Add tests for all four schedule values and package labels; verify the API request remains identity-only. Screen interaction assertions were added but cannot execute until `react-test-renderer` is available.
- [x] Add screen cases for latest-tap debounce, tap-back cancels the timer, skeleton hides the old QR, failed/ambiguous cancellation, and a PAID race creating no second order. These component cases remain unexecutable until `react-test-renderer` is available.
- [x] Run focused tests first to establish the intended failure, implement the minimal changes, then rerun:
  `pnpm test -- --runInBand __tests__/premium-screen.test.tsx __tests__/premium-purchase.test.ts` — purchase tests pass; screen tests are blocked by the missing `react-test-renderer` dependency (not added per scope constraints).
- [x] Review narrow-width layout structure, accessible radio labels, and touch targets in the component; shared app chrome was not changed.

## Task 3: Final verification and review

**Files:** all files changed in Tasks 1–2.

- [x] Run `pnpm exec tsc --noEmit` — fails on existing errors in app/index, Header, use-theme, BillAllocation, History, and JoinRoom; no errors point to the changed Premium files after the fix.
- [x] Run `pnpm run lint` — fails with 47 errors and 30 warnings across the project; no Premium files appeared in the reported findings. Expo auto-created an ESLint config during this command; that unrelated generated file was removed afterward.
- [x] Run `pnpm test -- --runInBand` — fails on existing database version expectations, missing `react-test-renderer`, Firebase emulator requirements, and a Jest/ESM `jose` incompatibility. Focused `premium-purchase.test.ts` passes (4 tests).
- [x] Inspect `git diff --check`, git status, and the complete diff. No whitespace errors; only approved Premium/docs/tests files plus the already-existing untracked image/prompt and the plan are present.
- [x] Check runtime availability: `adb` is not installed, so no Android device preview could be run. No iOS runtime is available in this Windows workspace.
- [x] Live server catalog verification remains unavailable in this workspace despite the user's confirmation that it was updated.

## Verification evidence

- Focused purchase/catalog unit tests: **PASS**, 4 tests.
- Debounced package-switch component cases: **ADDED, NOT EXECUTABLE** because Jest cannot resolve the existing `react-test-renderer` dependency.
- Premium screen test suite: **BLOCKED**, Jest cannot resolve the existing `react-test-renderer` dependency. No dependency was added.
- TypeScript: **FAIL**, existing project-wide errors listed above; changed Premium files are absent from the remaining error list.
- Lint: **FAIL**, 47 project-wide errors and 30 warnings; changed Premium files were not named in findings.
- Full Jest suite: **FAIL**, unrelated current failures include SQLite schema version expectations, missing render dependency, unavailable Firestore emulator, and CommonJS/Jest loading of `jose` ESM.
- Device visual verification: **NOT RUN**, `adb` unavailable and no iOS runtime.
- Express catalog: **NOT VERIFIED**, the server repository/API origin is not part of the workspace; the user stated that it has been updated.

## Constraints

- Same package IDs and version-1 API request shape.
- Server package data remains authoritative; app never sends amount or UID as trusted checkout input.
- No changes to payOS, Firebase security, entitlement math, or deployment.
- Reuse existing components/theme tokens. Extract only a repeated UI pattern without an existing fit.
- Keep the selection screen accessible and readable in the existing app shell.
- No dependencies, commit, or deployment unless explicitly requested.

