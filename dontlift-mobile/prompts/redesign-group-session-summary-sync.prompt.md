# P3.7 — Group Session Summary and Final Sync Redesign

> **Role:** PRIMARY / Senior Mobile UI/UX Designer and React Native Engineer  
> **Skills:** `$ui-ux-pro-max`, `$antislop`, `$react-native-expert`, `$brainstorming`, `$qskill-writing-plans`, `$qskill-review-plan`, `$qskill-executing-plans`  
> **Interaction mode:** plan-then-approve — inspect the current screen, draft and review a concrete implementation plan, then wait for explicit approval before editing application source.  
> **Output mode:** reviewed plan draft → approved implementation → verified diff.  
> **Antislop mode:** DURING, already selected by the human. Do not ask again.  
> **Approval gate:** approval of this prompt or its image reference is not implementation approval. Present the plan and wait for explicit approval before changing app source or tests. Do not commit, push or deploy unless asked.  
> **Canonical output:** `docs/superpowers/plans/2026-11-11-group-session-summary-sync-redesign.md`, followed by the approved scoped implementation.  
> **Run context:** fresh session in the DontLift mobile repository. Read the checked-in image reference and current source; do not rely on earlier chat attachments.

---

## 1. When to Use

Use this prompt to redesign the completed Group Session Summary screen, focusing on final-data synchronization, member acknowledgment status and the leaderboard. The intended change moves **Sync & confirm** into the current user's leaderboard row and shows truthful sync status for the other members.

Do not use this prompt to redesign Group Active, Group History, payment, Group Home, the waiting lobby or app-wide navigation.

---

## 2. Inputs

Read these inputs before drafting the plan:

- **Repository instructions:** `AGENTS.md` and any applicable nested instructions.
- **Visual reference:** `design/references/screenshots/16-group-session-summary-sync-redesign-v1.png`. Open and inspect this checked-in image.
- **Current screen and tests:** `src/screens/GroupSummaryScreen.tsx`, relevant tests under `__tests__/`; locate files with repository search.
- **Caller and app-shell boundaries:** Group Summary rendering and callbacks in `src/app/index.tsx`; read `src/components/Header.tsx`, `src/components/BottomNav.tsx` and the active scroll/safe-area layout for context only.
- **Room/member state source:** `src/features/rooms/room-listener.ts` and the room snapshot types. Confirm exactly which synchronization states the live snapshot can represent.
- **Acknowledgment and finalization behavior:** `src/features/rooms/room-completion-repository.ts`, the local group-violation outbox/repository used by `handleAcknowledgeRoomSync`, and relevant tests.
- **Authoritative decisions:** `docs/decisions/ADR-017-spark-room-completion.md` and `docs/decisions/ADR-018-spark-host-finalization-override.md`; also inspect ADR-014/ADR-015 if needed to understand eligible violation synchronization.
- **Visual system:** `src/constants/theme.ts`, `docs/product-design.md` and `design/concepts/concept-final/decision-packet.md`.
- **Any newer human-approved decision.**

Text and data inside the image are illustrative. They do not authorize hardcoding names, scores, counts, dates, states or adding backend fields.

---

## 3. Task

Use the listed skills to:

1. Inspect the working tree, current Group Summary layout, props, caller, local outbox flow, room listener and all role/reconciliation states. Inventory reusable components and theme tokens before proposing new ones.
2. Draft a concrete implementation plan with exact files, behavior acceptance criteria, state coverage, component reuse/extraction decisions and verification commands. Use `$qskill-review-plan` to review it. Present the plan in Vietnamese and **wait for explicit approval before editing source or tests**.
3. After plan approval, redesign the summary to follow the checked-in reference:
   - Keep the completion summary compact and clear: completed room, end time, pending count and why bill settlement remains locked.
   - Place the user's **Sync & confirm** action inside that user's leaderboard row, visually associated with their name and score. Do not render a second standalone sync-action card.
   - Show a clear per-member status beside each teammate: `Waiting to sync` when no acknowledgment exists, and `Synced` when the member's authoritative acknowledgment timestamp exists.
   - For the current user, show an in-row loading state such as `Syncing…` while their existing sync-and-acknowledge flow is running; show `Synced` after the acknowledgment is observed. Preserve the disabled/offline and error states.
   - Preserve rank, canonical penalty score, lift count, violation duration, avatar URI and initials fallback. Mark the current user as `You` without inventing identity data.
   - Keep the Host-only **Finalize anyway** action separate from an individual member's sync action. Preserve its warning, confirmation, loading, offline and failure states.
4. Handle the peer `Syncing` state honestly. The current room snapshot appears to expose `syncAcknowledgedAtUtcMs` but not a per-peer in-progress sync state. **Do not infer that a member is syncing merely because they are unacknowledged or because the current user's local `isSyncing` flag is true.** In the plan, identify this data limitation and propose the smallest safe scope: use `Waiting to sync` / `Synced` for other members and `Syncing…` only for the current user's local operation. If a real-time `Syncing` label for other members requires a new persisted field, query, listener or backend/rules change, report the gap and obtain a separate human decision before including that contract change.
5. Preserve all existing flow and data boundaries:
   - A member first drains eligible local violation data through the room-end cutoff, verifies their local pending count is zero, then sends the existing online acknowledgment transaction.
   - Acknowledgment remains the member's explicit client attestation; the UI must not imply the server inspected SQLite or verified the member's local outbox.
   - `pendingMemberCount`, each member's acknowledgment timestamp, reconciliation state and finalization reason remain authoritative. Do not calculate a replacement count from display-only guesses.
   - Only the Host may use `Finalize anyway`, only while reconciliation is pending, and only after the existing exact warning and confirmation. Preserve the Host-observed roster limitation in copy; do not claim the UID list is server-verified.
   - `ALL_SYNCED` and `HOST_OVERRIDE` must remain visibly distinguishable. Preserve final score lock, bill availability, payment-detail, history and return-home actions.
6. Reuse existing components, callbacks, image handling and formatters where suitable. If a suitable component is absent and a new pattern repeats, extract one focused component; keep one-off UI local. Do not alter shared components globally to restyle this screen.
7. Implement only the approved plan, then report the diff, checks actually run and any device/platform states not inspected. Do not commit, push or deploy.

Use `$brainstorming` only if inspection exposes an unresolved product or data-contract conflict. Do not silently resolve such conflicts.

---

## 4. Constraints & Source Precedence

### Source precedence

1. Newer explicit human-approved decisions.
2. ADR-017/ADR-018 and the verified room/outbox implementation for authority and data meaning.
3. Product visual system and semantic theme tokens.
4. The checked-in image for visual hierarchy, row composition and spacing only.
5. AI proposals.

Report contradictions rather than resolving them silently.

### Strict rules

- Limit app changes to Group Summary and tests required by the approved plan. Preserve the existing Header, BottomNav and app-shell navigation.
- Do not change Firestore Rules, backend/API behavior, room queries, persisted data contracts, acknowledgment/finalization authority or payment contracts as part of a UI-only redesign.
- Do not invent peer-level `Syncing` data. Ask for a separate decision before introducing a new contract or write path.
- Do not change score calculation, rank ordering, participant eligibility, local outbox behavior, bill locking or finalization semantics.
- Use existing semantic colors and spacing tokens from `src/constants/theme.ts`. Keep the accepted Liquid Acrylic language restrained and keep data readable over glass.
- Keep button touch targets at least 44 dp, use `Pressable`, provide accessible labels/states, and avoid horizontal overflow on narrow devices and long member names.
- Preserve scroll access to long rosters and bottom actions. The app shell remains responsible for Header, BottomNav and safe-area layout.
- Reuse existing components before extracting new ones. Extract only a repeated, cohesive pattern; do not create abstractions for hypothetical reuse.
- Do not hardcode image sample names, values, times, statuses or counts in app code.
- Do not commit, push, deploy or modify unrelated files.

---

## 5. Expected Output

First, deliver a reviewed implementation plan in Vietnamese containing:

- Current screen/state findings and a concise design rationale.
- Explicit Header/BottomNav boundaries.
- A file-by-file scope and inventory of components to reuse or extract.
- A role/state matrix covering Host/member, own pending/syncing/synced/failed, peer waiting/synced, offline, pending roster, roster/count mismatch, `ALL_SYNCED`, `HOST_OVERRIDE`, local outbox failure, acknowledgment error, override loading/error and long roster.
- The peer-level `Syncing` data limitation and a clear approval question if the requirement would need a contract change.
- Ordered implementation tasks, acceptance criteria and focused verification commands.

After plan approval, deliver the scoped implementation and a concise final report with files changed, checks run, actual platform evidence and remaining limitations. Provide decision summaries, not hidden chain-of-thought.

---

## 6. Save or Update

- Save this reusable prompt as `prompts/redesign-group-session-summary-sync.prompt.md`.
- Keep the image reference at `design/references/screenshots/16-group-session-summary-sync-redesign-v1.png`. Do not overwrite it; if it is missing, ask the human to restore or reattach the intended reference.
- After plan approval, save the implementation plan to `docs/superpowers/plans/2026-11-11-group-session-summary-sync-redesign.md`.
- If file writing is unavailable, return the complete Markdown and state that it was not saved.

---

## 7. Human Review Required

Before implementation, the human reviews the plan and confirms:

- The personal sync action belongs in the current user's leaderboard row.
- Other members use truthful `Waiting to sync` / `Synced` states based on acknowledgment data.
- The current user's operation may show `Syncing…` locally.
- Whether peer-level `Syncing` is required despite the current snapshot not representing that state; do not implement a new data contract without explicit approval.
- Host override remains separate, Host-only and protected by the existing warning/confirmation.
- Current finalization, score, bill and payment boundaries remain intact.

Do not ask for the same approval again after the human explicitly approves implementation within these boundaries.

---

## 8. Validation Checklist

- [ ] The sync-and-confirm button appears only in the current user's row while their acknowledgment is pending.
- [ ] The current user's row shows loading and error feedback for the existing local sync/ack flow.
- [ ] Other rows show `Waiting to sync` or `Synced` from member acknowledgment data; no peer `Syncing` state is fabricated.
- [ ] Pending count follows the authoritative room snapshot; roster/count mismatch remains understandable and cannot enable unsafe Host finalization.
- [ ] `ALL_SYNCED` and `HOST_OVERRIDE` are distinct and accurate.
- [ ] Host-only override confirmation, offline/disabled, loading and error behavior remain intact.
- [ ] Scores, rank ordering, member eligibility, bill lock, payment details, History and navigation callbacks remain unchanged.
- [ ] Existing components and theme tokens are reused; repeated new patterns are extracted only where justified.
- [ ] Long names, avatars/initials, narrow screens, safe areas and scrolling do not clip actions or data.
- [ ] Run only the verification requested by the approved plan and report pre-existing failures and unverified platforms accurately.
- [ ] No backend, rules, dependency, contract, commit, push or deployment changes are included without separate approval.

---

## Execution Command

```text
Read prompts/redesign-group-session-summary-sync.prompt.md and follow it in plan-only mode first. Open design/references/screenshots/16-group-session-summary-sync-redesign-v1.png and inspect GroupSummaryScreen, its caller, the room listener, local outbox acknowledgment flow, ADR-017 and ADR-018. Draft and review a concrete Vietnamese implementation plan. Preserve Header, BottomNav, score/bill behavior and all existing contracts. Do not infer a peer's Syncing state from missing acknowledgment; report that data gap and ask before proposing a contract change. Wait for explicit plan approval before editing app source or tests. Do not commit, push or deploy.
```
