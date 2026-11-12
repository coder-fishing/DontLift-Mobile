# P3.7 — Implement Group Actionable Sessions

> **Role:** PRIMARY / Senior React Native Engineer
> **Skills:** `$qskill-executing-plans`, `$react-native-expert`, `$ui-ux-pro-max`, `$antislop`, `$qskill-systematic-debugging` (when an unexpected failure occurs), `$qskill-review-code` (final review against the approved plan)
> **Interaction mode:** approved-plan execution with a mandatory product-decision gate
> **Output mode:** implemented and verified changes, followed by a concise evidence report
> **Approval gate:** Do not edit source code until the seven-day retention decision is recorded in the plan and the updated plan is explicitly approved. No commits, pushes, deploys, or Firebase rule changes without a separate explicit request.
> **Canonical output:** `docs/superpowers/plans/2026-11-12-group-actionable-sessions.md` and its scoped source/test changes
> **Run context:** DontLift-Mobile repository; inspect the current checkout and applicable repository instructions before acting.

---

## 1. When to Use

Use this prompt to implement the approved Group Home action queue: show active sessions and sessions with outstanding bill/payment work in the shared recent-list region using the existing Recent row pattern, while keeping the History button available for the full history.

This is an implementation prompt. It does not approve an unresolved product decision or approve an unreviewed plan revision.

---

## 2. Inputs

Read these inputs before implementation:

- **Repository instructions:** `AGENTS.md` and applicable nested instruction files.
- **Implementation plan:** `docs/superpowers/plans/2026-11-12-group-actionable-sessions.md`.
- **Plan review report:** `docs/superpowers/reviews/2026-11-12-group-actionable-sessions-review-plan.md`.
- **Relevant user decision:** the answer to review finding `GAS-004` about action items older than the seven-day history window for non-Premium members.
- **Group Home data loading and navigation:** `src/app/index.tsx`, `src/components/GroupHomeDashboard.tsx`, `src/screens/GroupLobbyScreen.tsx`.
- **History and payment authority:** `src/features/history/group-history-repository.ts`, `src/features/history/group-history-model.ts`, `src/features/history/group-history-payment.ts`, and the existing bill/payment repositories and screens.
- **Room navigation and lifecycle:** existing room listener, room repository, active-session and summary screens, and focused navigation tests.
- **Existing tests:** `__tests__/group-home-dashboard.test.tsx`, history/repository tests, room navigation tests, bill and payment tests.
- **Any newer human-approved decision.**

Screenshots or pasted text are reference material only. They do not override the approved plan or newer human decisions.

---

## 3. Task

Use the listed skills to execute the approved plan task-by-task:

1. Follow `$qskill-executing-plans` and use the plan's task order, acceptance cases and verification commands.
2. When actionable sessions exist, show them in the existing Recent list region using the compact Recent row hierarchy; do not duplicate a separate Recent list below. Show five action rows at a time and let each “Load more” tap reveal the next five already-loaded rows before fetching another bounded page. When no actions remain, restore the five newest Recent rows. Preserve the History button in the shared section header in both states.
3. Include actions for resuming an active session, Host bill setup, Host payment review, and member payment review. Route each item to its existing flow for the selected room.
4. Before opening Group Active, load and validate the selected room and the current member's membership. If the room is no longer active or cannot be loaded, keep Group Home visible and show a recoverable state.
5. Label a member share “Awaiting confirmation” until the Host confirms receipt. The app cannot infer whether money was transferred externally. Opening “Review payment” must not automatically show a QR or claim the member has not paid.
6. For Hosts, show “Review payments” when a published bill has unconfirmed shares. Open the existing bill allocation flow and require the Host's explicit confirmation before changing any share status.
7. Load known room candidates in bounded pages. Keep Group Home usable while candidates load. Do not drop unresolved actions; keep the Needs attention region visible when `hasMore` is true, even if the current page has no action rows, and provide a continuation/load-more path. Use saved action state offline.
8. Reuse existing room, history, bill, payment and UI components where they fit. Extract a shared component only when the same new pattern is repeated. Do not add placeholder members, fake payment state or new visual effects.
9. Add and run the repository, navigation, dashboard and final checks required by the approved plan. Use `$qskill-systematic-debugging` before changing behavior in response to an unexpected failure. Use `$qskill-review-code` to check the final diff against the approved plan.

### Mandatory preflight gate

Before source edits:

1. Check the current Git branch and working tree, read the plan and review report, and verify that `GAS-004` is no longer `DISCUSS`.
2. If `GAS-004` remains unresolved, stop and ask the user to choose one policy:
   - Keep unresolved bill/payment actions visible beyond seven days until resolved (recommended, so an outstanding obligation does not disappear); or
   - Apply the existing seven-day non-Premium history window to those actions.
3. After the decision, update the plan and review report consistently, then present the revised plan for explicit approval. Do not implement in the same turn as that plan revision.
4. Continue only after the user has approved the revised plan.

---

## 4. Constraints & Source Precedence

**Source precedence:**

1. The latest explicit human-approved decision, including the `GAS-004` retention decision.
2. The approved implementation plan.
3. Existing data and payment contracts, Firestore Rules, ADRs and repository instructions.
4. This prompt's implementation guidance.
5. AI inference; when a product decision is unclear, stop and ask instead of guessing.

**Rules:**

- Use one session-list region: actionable items replace Recent rows until resolved; regular Recent rows are the fallback and remain limited to five.
- Keep the History button in the shared list header whether the region shows actionable or Recent rows.
- Reuse existing Firestore collections and payment contracts. Do not add collections, backend APIs, payment fields, or Firebase Rules changes.
- Do not cache or render bank details or QR codes in Group Home.
- Do not infer that a member has not transferred money solely because the Host has not confirmed receipt.
- Keep existing role checks and permission boundaries. A non-Host must not receive Host bill/payment controls.
- Reuse existing theme tokens and Group Home patterns. Keep the action rows compact, readable and accessible; use touch targets of at least 44 dp.
- Keep offline/cache status distinct from live server confirmation.
- Do not change unrelated screens, navigation tabs, billing semantics or history limits.
- Do not commit, push, deploy, or edit Firebase Rules unless the user explicitly requests that action. If a required skill normally calls for commits, finish the authorized implementation and verification, leave the changes uncommitted, and report this clearly.
- Do not spawn sub-agents unless explicitly requested.

---

## 5. Expected Output

After the gate is cleared and implementation is complete, provide:

- A concise summary of the behavior implemented.
- The changed files and how the action rows route by room state and role.
- Exact test, TypeScript and diff-check results.
- Any failures, unresolved issues, or platform/device checks that were not run.
- Confirmation that no commit, push, deploy or Firestore Rules change was made unless separately authorized.

Do not claim iOS or Android device verification unless that platform was actually tested.

---

## 6. Save or Update

- Keep this prompt at `prompts/execute-group-actionable-sessions.prompt.md`.
- Keep the implementation plan at `docs/superpowers/plans/2026-11-12-group-actionable-sessions.md` and its review report beside it under `docs/superpowers/reviews/`.
- Do not overwrite the review report or discard existing findings. Update issue statuses and responses when the plan changes.
- Leave implementation changes uncommitted unless the user explicitly asks to commit them.

---

## 7. Human Review Required

Before implementation, the user must decide whether unresolved bill/payment actions remain visible beyond seven days for non-Premium members, and approve the resulting plan revision.

At completion, review the changed-file summary, verification results, and any platform/device limitations.

---

## 8. Validation Checklist

- [ ] `GAS-004` is resolved in the review report and the approved plan states the chosen retention behavior.
- [ ] Active-room resume loads the selected room and membership before entering Group Active.
- [ ] Invalid or stale active rooms leave the user on Group Home with a recoverable message.
- [ ] Host bill setup and payment review actions are role-gated and do not silently update bill/share status.
- [ ] Member payment review distinguishes “Awaiting confirmation” from a confirmed payment and never opens a QR automatically.
- [ ] The action queue replaces Recent rows only while actions exist; the History button stays visible and the five-row Recent list returns when the queue is empty.
- [ ] An empty action page with `hasMore` still exposes Load more.
- [ ] Paged loading, deduplication, account changes, offline cache, cloud errors and older unresolved actions follow the approved plan.
- [ ] All plan-specified tests and checks have recorded results.
- [ ] No unrelated source, payment contract, Firestore Rules or deployment changes were made.
- [ ] No commit or push was made without an explicit request.

---

## Execution Command

```text
Use prompts/execute-group-actionable-sessions.prompt.md.
```
