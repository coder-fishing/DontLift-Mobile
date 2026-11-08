# P3.4 — Premium Pricing Screen Redesign

> **Role:** PRIMARY / Senior Mobile UI/UX Designer and React Native Engineer  
> **Skills:** `$ui-ux-pro-max`, `$antislop`, `$react-native-expert`, `$brainstorming`, `$qskill-writing-plans`, `$qskill-executing-plans`  
> **Interaction mode:** plan-then-approve — inspect the repository, draft a concrete plan, then wait for explicit human approval before source changes.  
> **Output mode:** implementation plan draft → approved implementation and focused tests.  
> **Antislop mode:** DURING — already selected by the human for this redesign. Apply its visual and copy checks while working; do not ask for this mode again.  
> **Approval gate:** the human has approved the attached pricing reference and design direction. Still obtain explicit approval for the implementation plan before editing source or backend files. Show the final diff before any commit. Do not commit or deploy unless explicitly asked.  
> **Canonical output:** `docs/superpowers/plans/YYYY-MM-DD-premium-pricing-redesign.md`, then the narrowly scoped Premium pricing implementation and tests in the authoritative repositories.  
> **Run context:** fresh session from the DontLift repository root. Read the checked-in reference image; do not rely on chat attachment access.

---

## 1. When to Use

Use this prompt to redesign the existing DontLift Premium plan selection screen using the approved visual reference and to replace the old Premium package pricing/bonus schedule with the new human-approved schedule below. Preserve the existing online payOS checkout and expiring entitlement flow. Do not use it to redesign other tabs, change payment providers, or deploy services.

---

## 2. Inputs

Read these inputs before drafting the plan:

- **Repository instructions:** `AGENTS.md`.
- **Approved visual reference:** `design/references/screenshots/14-premium-pricing-redesign.png`.
- **Product visual system:** `docs/product-design.md`, `design/concepts/concept-final/decision-packet.md`, and `src/constants/theme.ts`.
- **Current Premium behavior and constraints:**
  - `docs/decisions/ADR-025-payos-expiring-premium.md`
  - `docs/superpowers/specs/2026-10-23-sl-031-032-payos-premium-design.md`
  - `docs/superpowers/plans/2026-10-23-sl-031-032-payos-premium.md`
  - `docs/api-contracts.md`
  - `docs/software-architecture.md`
- **Current mobile implementation and tests:**
  - `src/screens/PremiumScreen.tsx`
  - `src/features/premium/premium-api.ts`
  - `__tests__/premium-screen.test.tsx`
  - `__tests__/premium-purchase.test.ts`
- **Authoritative package catalog:** locate the Express Premium backend repository/configuration used by this app and inspect its package catalog and tests. Do not assume the mobile fallback is authoritative. If that repository is unavailable in the current workspace, stop before implementation and report the missing repository/path as a blocker; do not fake new prices in the UI while leaving checkout at old server prices.
- **Any newer human-approved decision** in the current conversation or repository.

The new human-approved package schedule in this conversation supersedes the old prices and bonus schedule in ADR-025 and historical plans for the purpose of this redesign. Preserve all unrelated ADR-025 architecture and payment-safety decisions. Report other contradictions instead of silently resolving them.

---

## 3. Task

Use the listed skills to:

1. Inspect the mobile screen, checkout/catalog flow, existing components and theme tokens, authoritative backend package catalog, related tests, and git status. Draft a task-by-task implementation plan with exact files, acceptance criteria, risks, and verification commands. **Wait for explicit approval before editing source, tests, or backend files.**
2. After plan approval, update the Premium selection screen to follow the checked-in reference: clear plan hierarchy, legible aligned price/options, a restrained selected state, and an accessible primary payment action. Preserve the current DontLift Liquid Acrylic identity with restrained surfaces and accent use; do not reproduce every visual effect from the reference blindly.
3. Update the package schedule consistently across the authoritative server catalog, client fallback/display catalog, and focused tests. Keep the existing package IDs unless repository evidence shows a necessary migration; if IDs or stored order semantics must change, explain the impact in the plan and obtain approval first.

   | Package ID | Price | Paid months | Premium months granted | Displayed offer |
   |---|---:|---:|---:|---|
   | `MONTH_1` | 30,000 VND | 1 | 1 | 1 month |
   | `MONTH_3` | 79,000 VND | 3 | 4 | 3 months + 1 month free |
   | `MONTH_6` | 149,000 VND | 6 | 8 | 6 months + 2 months free |
   | `MONTH_12` | 249,000 VND | 12 | 16 | 12 months + 4 months free; Best Value |

4. Make prices, paid duration, granted duration, bonus text, and selected package state derive from the actual catalog data where practical; avoid hardcoded UI copy that can drift from the catalog. The UI must not claim a bonus unless the authoritative catalog grants it.
5. Preserve these existing behaviors and boundaries:
   - the server remains authoritative for package price, duration, order amount, and entitlement;
   - the client submits package ID/request ID only, never a trusted amount or UID;
   - existing authenticated payOS checkout, QR/order restoration, status checks, cancellation/switch safeguards, and entitlement expiry behavior;
   - one-time purchase with no automatic renewal;
   - no secrets in the mobile app and no Firebase client entitlement writes.
6. When a checkout is pending, selecting a different plan starts an automatic switch after a 400 ms debounce. Use only the latest selection; selecting the active package again before the timer fires cancels the scheduled switch and restores the existing QR without a server call. This behavior was approved by the human on 2026-11-08 and supersedes the earlier confirmation-button interaction.
7. Keep switching safe: once the cancellation request starts, disable plan selection; hide the old QR and checkout link and show an accessible loading skeleton. Do not create or show a replacement QR until the server confirms the previous order is terminal. If cancellation fails or its result is ambiguous, reconcile the exact saved order if possible, create no replacement, and offer retry/return-to-current-plan actions. If the order is PAID, preserve the paid result and do not create another order.
8. Reuse existing components, formatters, interaction patterns, and semantic theme tokens. Extract a new component only when the same new UI pattern repeats and no suitable component exists; keep one-off screen UI local. Do not add dependencies or perform broad shared-component refactors.
9. Add or update focused tests for all four package values and grants, displayed bonus/price, selection and checkout package ID, debounced package switching, cancellation reconciliation, plus existing pending/paid/error/offline states affected by the change. Add backend tests for authoritative values if the backend repository is available.
10. After approval and implementation, run focused Premium tests, typecheck, lint, and any available backend tests. Report exactly what ran. Do not claim device or live payOS validation unless it was actually performed.

---

## 4. Constraints & Source Precedence

### Source precedence

Resolve conflicts in this order:

1. Newer explicit human-approved decisions, including the pricing schedule in this prompt.
2. ADR-025 and Premium design/API contracts for architecture, server authority, payment safety, and entitlement behavior.
3. Product design documents and `src/constants/theme.ts` for visual identity and tokens.
4. The checked-in Premium mockup for layout, hierarchy, and styling only.
5. Current implementation as evidence of existing behavior, not permission to broaden scope.
6. AI inference or proposals.

### Strict rules

- Keep changes scoped to Premium pricing presentation, the authoritative package catalog, its client display/fallback catalog, and tests/documentation required to keep those values consistent.
- Preserve payment wire contracts and package ID semantics unless a concrete incompatibility is found. Do not accept client-provided prices as authoritative.
- Do not change payOS behavior, order idempotency, entitlement calculation, Firebase Rules, retention, or deploy/hosting configuration as part of this task.
- Do not display stale package prices as current while server catalog loading fails. Clearly distinguish unavailable/loading/error states and keep checkout disabled until the authoritative catalog is ready, as existing behavior requires.
- Reuse suitable existing components and utilities. If a new pattern repeats within this feature and no existing component fits, extract one focused component; keep one-off UI local and avoid hypothetical abstractions.
- Use existing semantic theme tokens. Do not add raw palette values to shared components or modify unrelated screens.
- Keep all options readable on narrow phones; maintain safe areas, accessible names, radio selection state, and minimum 44 dp touch targets.
- Apply antislop DURING. Design Read: a mobile Premium plan comparison screen that lets returning users compare duration, total price, and the actual extra months at a glance. Dials: **ENERGY 4 / RHYTHM 2 / MOTION 1**. Keep the existing DontLift acrylic identity as a restrained motif; use opaque, high-contrast option surfaces for price comparison, one clear selected-plan accent, and limited green emphasis for included bonus months. Avoid generic gradient-heavy pricing templates, decorative glow, fake product claims, and unverified savings math.
- Inspect `git status` before edits and preserve unrelated user changes. Never reset, revert, or overwrite unrelated work.
- Do not output hidden chain-of-thought. Provide concise rationale, decisions, and unresolved questions only.
- Do not commit or deploy unless explicitly requested.

---

## 5. Expected Output

### Before approval

Return and save the plan at the canonical plan path only after the human approves saving it. Include:

- current screen structure and payment/catalog architecture found in the repositories;
- the authoritative location of the package catalog and whether it is available;
- tasks with exact files and observable acceptance criteria;
- how each of the four approved prices/month grants maps to display and checkout;
- component reuse/extraction decisions;
- focused tests and verification commands;
- risks, baseline failures, and unresolved contradictions.

Do not modify source files or tests before the plan is explicitly approved. If the authoritative server catalog cannot be accessed, stop at the plan and clearly state that the implementation cannot safely update prices in the client alone.

### After approval

Implement the approved plan. Report changed files, user-visible results, tests and commands actually run, device/live checks completed, blocked checks, and final diff summary. Do not claim an unrun check passed.

---

## 6. Save or Update

After plan approval, save/update:

- **Implementation plan:** `docs/superpowers/plans/YYYY-MM-DD-premium-pricing-redesign.md` (use the actual execution date).
- **Premium screen and client catalog:** `src/screens/PremiumScreen.tsx` and `src/features/premium/premium-api.ts`, only as required by the approved plan.
- **Authoritative server catalog:** update the actual backend repository's package configuration and focused tests only after locating it and including its exact paths in the approved plan.
- **Focused tests:** `__tests__/premium-screen.test.tsx`, `__tests__/premium-purchase.test.ts`, and relevant backend catalog tests.

Do not update historical ADRs or plans silently. If an active source-of-truth document needs a corresponding update, include that exact file and rationale in the plan for review.

---

## 7. Human Review Required

Before approving the implementation plan, review:

- whether all four prices and granted durations match the approved schedule;
- whether the backend repository and authoritative catalog are correctly identified;
- whether the reference hierarchy fits the existing Premium flow and small screens;
- whether the selected package, actual bonus months, and total price are clear;
- whether all existing payment safety, retry, restore, and entitlement behavior stays intact;
- whether scope avoids unrelated navigation, shared components, or screens.

Before accepting implementation, review the diff and test evidence. Any proposed change to package IDs, payment contract, entitlement policy, or backend deployment requires a separate explicit decision.

---

## 8. Validation Checklist

- [ ] The human-approved new schedule is applied consistently to the authoritative server catalog and client fallback.
- [ ] `MONTH_1` is 30,000 VND and grants 1 month.
- [ ] `MONTH_3` is 79,000 VND, charges 3 months, and grants 4 months.
- [ ] `MONTH_6` is 149,000 VND, charges 6 months, and grants 8 months.
- [ ] `MONTH_12` is 249,000 VND, charges 12 months, and grants 16 months; Best Value is visibly associated with this plan.
- [ ] Bonus labels are derived from authoritative `paidMonths`/`grantedMonths` and do not overstate the package.
- [ ] The client does not send a trusted amount; checkout uses the server's current catalog and order amount.
- [ ] Existing payOS order, retry, restore, cancellation, status, and expiry behaviors remain covered and intact.
- [ ] Loading, server-catalog error, offline, pending, paid, and expired states remain understandable and truthful.
- [ ] Existing components and theme tokens are reused; repeated new UI is extracted only when justified; one-off UI remains local.
- [ ] Accessibility labels, radio state, safe areas, narrow layouts, and 44 dp touch targets are addressed.
- [ ] Focused mobile/backend tests, typecheck, and lint are run and reported accurately.
- [ ] No secrets, deployment changes, unrelated edits, commit, or push are introduced.

---

## Execution Command

```text
Read `prompts/redesign-premium-pricing.prompt.md` and follow it in plan-only mode first. Inspect all required inputs and locate the authoritative Premium backend catalog. Draft the implementation plan with the four approved package prices and month grants, save it only after I approve the plan, then wait for explicit approval before changing source code or tests.
```
