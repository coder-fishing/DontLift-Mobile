# P3.3 — Group History and Session Detail UI Redesign

> **Role:** PRIMARY / Senior React Native UI/UX Engineer
> **Skills:** `$ui-ux-pro-max`, `$antislop`, `$react-native-expert`, `$brainstorming`, `$qskill-writing-plans`, `$qskill-executing-plans`
> **Interaction mode:** plan-then-approve — inspect the repository, draft a concrete plan, then wait for explicit human approval before source changes.
> **Output mode:** implementation plan draft → approved implementation and focused tests.
> **Approval gate:** get approval for the plan and behavior before editing source; show the final diff before any commit. Do not commit or push unless explicitly asked.
> **Canonical output:** `docs/superpowers/plans/2026-11-08-group-history-redesign.md`, then the narrowly scoped Group History implementation and tests listed in the approved plan.
> **Run context:** fresh session in the repository root. The two visual references are checked into `design/references/screenshots/`; read them from the repository rather than relying on chat attachments.

---

## 1. When to Use

Use this prompt when redesigning the existing Group History list and a selected session's detail screen, and when addressing repeated History refreshes or confusing `Pay my share` confirmation states. The existing app flow must be inspected before proposing changes. Do not use this prompt to redesign the whole app or unrelated Group tabs.

---

## 2. Inputs

Read these inputs before drafting a plan:

- **Repository instructions:** `AGENTS.md`.
- **Approved behavior and data boundaries:**
  - `docs/superpowers/specs/2026-11-04-shared-group-history-design.md`
  - `docs/decisions/ADR-023-spark-manual-payment-status.md`
  - `docs/decisions/ADR-024-spark-group-history.md`
  - `docs/decisions/ADR-028-shared-group-history-index.md`
- **Product visual system:** `docs/product-design.md`, `design/concepts/concept-final/decision-packet.md`, and `src/constants/theme.ts`.
- **List visual reference:** `design/references/screenshots/11-group-history-list-redesign.png`.
- **Detail visual reference:** `design/references/screenshots/12-group-history-detail-redesign.png`.
- **Current implementation and focused tests:**
  - `src/screens/GroupHistoryScreen.tsx`
  - `src/screens/HistoryPaymentScreen.tsx`
  - `src/screens/VietQRSettlementScreen.tsx`
  - `__tests__/group-history-screen.test.tsx`
  - `__tests__/group-history-payment.test.ts`
  - `__tests__/payment-details-listener.test.ts`
- **Any newer human-approved decision** in the current conversation or repository.

Treat the mockups as visual references for hierarchy and styling. They are not authoritative for data, business rules, payment state, or exact copy where that conflicts with the repository's contracts.

---

## 3. Task

Use the listed skills to:

1. Inspect the current implementation and inputs, then draft a task-by-task implementation plan with the exact files to change, acceptance criteria, and verification commands. **Stop and wait for explicit approval before editing source code.**
2. After approval, inventory existing components, hooks, formatters, and theme tokens. Reuse suitable existing pieces, then redesign only the Group History list and selected-session detail to follow the two references.
3. Make result meanings explicit:
   - distinguish the member's local/session score from the canonical room score;
   - distinguish a saved copy from data successfully confirmed by Firebase;
   - identify the current member as `You` and clearly associate their share amount with the payment action when the current data supports it.
4. Preserve the existing History flow, `initialRoomId`, pagination, access boundaries, score/bill contracts, and payment listener authority.
5. Fix repeated refresh behavior within the existing History flow:
   - load local history first;
   - refresh on screen entry, explicit refresh/retry, or an offline-to-online transition;
   - do not refresh solely on app foreground or repeated callbacks that report the same network state;
   - retain visible content while refreshing and avoid duplicate list/detail refreshes for one action.
6. Keep payment safe and understandable:
   - never show cached bank details or a cached QR;
   - show a QR only after current server-confirmed room, membership, bill revision, paid counter, and payment details match;
   - invalidate old payment data on retry or when current server state no longer matches;
   - on return from payment, refresh the selected detail once without unnecessarily reloading the list.
7. If a needed UI pattern has no suitable existing component and repeats in multiple places within this feature, extract one small focused component and use it consistently. Keep one-off UI local; avoid abstractions for hypothetical reuse or refactors outside the approved scope.
8. Implement the approved plan in small, reviewable steps and update focused tests for the behaviors changed.

---

## 4. Constraints & Source Precedence

### Source precedence

Resolve conflicts in this order:

1. Newer explicit human-approved decisions.
2. Applicable ADRs and the shared Group History design specification for behavior, authority, and data boundaries.
3. Product design documents and `src/constants/theme.ts` for the visual system.
4. The two checked-in mockups for layout and visual hierarchy only.
5. Current source code as evidence of existing implementation, not as permission to broaden scope.
6. AI inference or proposals.

Report contradictions instead of silently resolving them. If a conflict affects payment safety, access, scoring, or the requested visual outcome, stop and ask before implementation.

### Strict rules

- Keep changes limited to Group History, its detail/payment presentation, and tests required by the approved plan.
- Do not redesign Solo, Group Home, Group Lobby, Pro, Account, or the app-wide navigation.
- Do not broadly restyle shared components such as `Header`, `BottomNav`, `AppBackground`, `PrimaryButton`, or `GlassCard`. If a shared component change is necessary, explain it in the plan, make its styling opt-in, and verify other screens retain their current appearance.
- Use existing semantic tokens. Add no dependency, schema, Firebase query, API, payment contract, backend function, or local bank-detail/QR storage.
- Reuse suitable existing components/utilities before creating new ones. Extract a new component only for a repeated pattern within the approved Group History scope when no existing component fits; keep the extraction focused and avoid broad shared-component refactors.
- Do not invent avatars, member previews, scores, dates, payment states, or other roster data.
- Keep the existing English product copy style unless a newer approved decision says otherwise.
- Preserve safe areas, accessible labels, platform behavior, touch targets of at least 44 dp, and `FlatList` virtualization for dynamic lists.
- Inspect `git status` before editing and preserve unrelated user changes. Do not reset, revert, or overwrite existing work.
- Do not output hidden chain-of-thought. Provide a concise rationale, decisions, and any unresolved questions instead.

---

## 5. Expected Output

### Before approval

Return an implementation plan in chat and save it to the canonical plan path only if the user approves saving. The plan must include:

- the current behavior and relevant architecture found in the repository;
- each task, exact files, and observable acceptance criteria;
- the design decisions taken from the mockups and how they map to real data;
- refresh and payment state transitions;
- tests and verification commands;
- known risks, baseline failures, and any unresolved contradictions.

Do not modify source files or tests before the plan is explicitly approved.

### After approval

Implement the approved plan. Report:

- files changed and the user-visible changes;
- focused tests and verification commands actually run, with results;
- platform/device checks actually completed;
- any checks blocked by environment or pre-existing failures;
- the final diff summary. Do not claim an unrun check passed.

---

## 6. Save or Update

After the human approves the plan, save/update:

- **Implementation plan:** `docs/superpowers/plans/2026-11-08-group-history-redesign.md`.
- **Canonical screen:** `src/screens/GroupHistoryScreen.tsx`.
- **Payment presentation, only if the approved plan requires it:** `src/screens/HistoryPaymentScreen.tsx` and `src/screens/VietQRSettlementScreen.tsx`.
- **Focused tests, only for changed behavior:** the History and payment test files listed in Inputs.

If a file cannot be written, return the complete Markdown artifact or patch for the human to save. Do not create additional specs or change unrelated documentation unless requested.

---

## 7. Human Review Required

Before approving the plan, review:

- whether the list/detail hierarchy matches the references without obscuring important real data;
- whether local score and canonical room score are unambiguous;
- whether saved/cache, checking, confirmed, offline, and error states are truthful;
- whether the member's own share and payment action are clear;
- whether the refresh triggers avoid repeated loads and preserve visible content;
- whether the payment QR remains unavailable until current server data is confirmed;
- whether the file scope avoids unintended changes to other screens.

Before approving implementation, review the final diff and the verification evidence. Any change to scoring, payment authority, Firestore access, or shared app-wide UI requires a separate explicit decision.

---

## 8. Validation Checklist

- [ ] The implementation plan is approved before source edits begin.
- [ ] List and detail use real values and distinguish local/session score from canonical room score.
- [ ] Saved copy, checking, confirmed, offline, and error labels cannot be mistaken for one another.
- [ ] Current member and own share are correctly identified; no fake roster data is added.
- [ ] Offline entry reads local data without cloud sync; online entry refreshes once.
- [ ] Repeated same-state network callbacks and foreground transitions do not trigger History refresh.
- [ ] Offline-to-online and explicit refresh each trigger one refresh while retaining current content.
- [ ] Pagination, `initialRoomId`, list/detail navigation, and payment return remain intact.
- [ ] No bank details or QR are shown from cache or stale/mismatched server state.
- [ ] Retry invalidates stale payment data and starts one new confirmation attempt.
- [ ] Interactive controls have accessible names and at least 44 dp touch targets.
- [ ] Focused tests and relevant type/lint checks are run and reported accurately.
- [ ] The final diff contains only files in the approved scope.
- [ ] Suitable existing components, hooks, formatters, and tokens are reused; repeated new UI patterns are extracted once within scope, while one-off UI remains local.
- [ ] No secrets, API keys, or credentials are added.
- [ ] No commit or push is made unless explicitly requested.

---

## Execution Command

```text
Read `prompts/redesign-group-history.prompt.md` and follow it in plan-only mode first. Inspect every required input, draft the plan, and wait for my explicit approval before changing source code.
```
