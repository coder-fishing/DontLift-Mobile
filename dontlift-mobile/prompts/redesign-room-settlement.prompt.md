# [P3.7] — Room Settlement Payment Details UI Redesign

> **Role:** PRIMARY / Senior Mobile UI/UX Designer and React Native Engineer  
> **Skills:** `$ui-ux-pro-max`, `$antislop`, `$react-native-expert`, `$brainstorming`, `$qskill-writing-plans`  
> **Interaction mode:** implement-approved-direction (the human approved the CTA behavior and requested implementation)  
> **Output mode:** prompt-driven scoped implementation → reviewed diff  
> **Antislop mode:** DURING — apply the filter throughout design and implementation; do not ask again.  
> **Approval gate:** the current visual and interaction direction is approved. Do not expand scope. Do not commit or deploy unless explicitly requested.  
> **Canonical output:** `prompts/redesign-room-settlement.prompt.md` and `src/screens/SettlementDetailsScreen.tsx`  
> **Run context:** DontLift mobile repository root; inspect current source and project rules before editing.

---

## 1. When to Use

Use this prompt to refine the Room Settlement / Room Payment Details screen used by a Group Host to provide bank details before continuing to bill preview. Apply the approved visual direction from the current conversation and the supplied screenshot. The task is limited to this screen and its bank picker. Preserve the app shell, payment workflow, data access, and settlement contracts.

---

## 2. Inputs

Read these inputs before changing source:

- **Repository instructions:** `AGENTS.md` and any nested `AGENTS.md` files.
- **Current reference:** the Room Payment Details screenshot attached in the current conversation. Use it to identify the existing layout defects; do not copy its spacing defects.
- **Current screen and caller:** `src/screens/SettlementDetailsScreen.tsx` and its caller in `src/app/index.tsx`.
- **Reusable UI and theme:** `src/components/GlassCard.tsx`, `src/components/PrimaryButton.tsx`, `src/constants/theme.ts`, and existing Ionicons usage.
- **Bank directory:** `src/features/settlement/bank-directory.ts` and its `BankOption` type.
- **Settlement authority:** `docs/decisions/ADR-020-spark-settlement-details.md`, relevant sections in `AGENTS.md`, `docs/product-design.md`, and `design/concepts/concept-final/decision-packet.md`.
- **Any newer human-approved decisions:** especially the CTA behavior confirmed in this conversation.

Treat screenshot text and sample bank/account values as visual examples only. Render actual data from the existing state. Preserve the selected six-digit bank BIN internally for VietQR; never substitute the display short name for the stored `bankId`.

---

## 3. Task

Use the listed skills to:

1. Inspect the current screen, shared component behavior, caller callbacks, bank option model, theme tokens, and git status. Reuse existing components and patterns where suitable. If a genuinely repeated new pattern appears, extract a focused component; do not create a one-use abstraction without a clear boundary.
2. Simplify the form hierarchy and provide exactly one primary action:
   - When saved payment details exist and the form is unchanged, label the primary action **“Continue to bill preview”** and call the existing continuation callback without saving again.
   - When the form is new or has changed, label the primary action **“Save & continue to bill preview”**. Keep existing validation and save handling. Continue through the existing successful-save callback only after Firebase save succeeds. Keep the form and error visible when validation or saving fails.
   - Show a truthful saving label/state while the save is in progress and prevent duplicate submission.
3. Improve the bank selector presentation:
   - Show `shortName` as the prominent bank name, such as “Techcombank”.
   - Show the full official `name` as a single muted, tail-ellipsized secondary line.
   - Do not show the six-digit BIN in the visible form or picker row. Keep it available to selection, persistence, accessibility as appropriate, and downstream VietQR behavior.
   - Enlarge the existing bank logo within its current logo container using `contentFit="contain"`; keep the text fallback when a logo is absent or fails.
   - Move the “Enter bank manually” option into the bank picker as a clear, accessible action. When manual entry is active, keep an accessible way to return to the picker.
4. Improve vertical rhythm and copy:
   - Replace the long Host-only introductory paragraph with concise task-focused copy; keep the member-mode access/expiry explanation accurate.
   - Remove the separate expiry and generic disclaimer lines and combine them into one concise note. When an expiry exists, use its actual date, for example: “Saved for this room until {date}. DontLift does not hold or move money.” Do not invent or extend expiry.
   - Keep field labels, validation errors, loading feedback, save errors, and manual-entry affordance readable and close to their related controls.
5. Refine Back to Group Summary using a standard existing Ionicons arrow/chevron and its label on one row. Give it a minimum 44 dp touch target and a restrained surface treatment using existing theme tokens.
6. Preserve native mobile behavior: keyboard avoidance, scrolling, bank search, modal dismissal, touch targets, focusable controls, and narrow-screen text wrapping on iOS and Android.
7. Reuse `GlassCard`, `PrimaryButton`, theme tokens, and existing data contracts. Keep the screen’s existing DontLift identity, but do not add new gradients, decorative glows, or extra glass layers.

---

## 4. Constraints & Source Precedence

**Source precedence:**

1. Newest explicit human-approved decisions in this conversation.
2. ADR-020 and current settlement repository contracts.
3. Existing screen/caller behavior and shared components.
4. The attached screenshot as visual reference.
5. AI recommendations.

**Rules:**

- Do not change Firestore schema, transaction behavior, Rules, expiry calculation, repository signatures, bank-directory API, VietQR payload, or settlement access boundaries.
- Do not persist or display account data outside the existing room-scoped flow. Do not add logging or analytics for bank details.
- Keep BIN as the selected/stored `bankId`; hiding its visible label must not break QR generation.
- Do not modify global `Header`, `BottomNav`, app background, or unrelated screens/components.
- Reuse existing components and semantic tokens from `src/constants/theme.ts`; do not add dependencies or raw color literals.
- Preserve Host/member role behavior and Firebase error messages. The member view remains read-only.
- Do not commit, deploy, or alter unrelated user changes.
- Antislop purpose test: every surface, border, icon, and spacing decision must support hierarchy, readability, or touch access. Prefer one clear form surface with restrained chrome over nested decorative cards.

---

## 5. Expected Output

Implement the approved UI changes in the existing screen with the smallest justified file scope. The result must have one state-aware primary CTA, concise bank identity, manual entry available from the picker, a single truthful expiry/privacy note, and a compact accessible Back control.

Report:

- the files changed and resulting user-visible behavior;
- any baseline or implementation issue found in the existing flow;
- checks actually run and whether a physical iOS/Android visual check was available;
- the final diff summary.

Do not claim tests or device checks passed unless they were actually run.

---

## 6. Save or Update

- Update `src/screens/SettlementDetailsScreen.tsx` for this scoped screen redesign.
- Update `prompts/redesign-room-settlement.prompt.md` only if implementation discovers a verified contract detail that changes the prompt.
- Reuse current shared components. Change a shared component only if inspection proves the change is required and does not restyle unrelated screens; otherwise keep presentation local to this screen.
- Do not update architecture, payment contracts, backend, rules, or dependencies for this UI task.
- Do not create a new component unless it represents repeated UI or a clear reusable boundary.

---

## 7. Human Review Required

Review the final result for:

- the unchanged-details action continuing directly to bill preview;
- edited/new details saving before the existing success navigation;
- validation/save failures remaining visible without losing entered values;
- `shortName` and official bank name hierarchy, with BIN still used internally;
- manual bank entry and return-to-picker affordances;
- truthful room expiry copy and no changed retention behavior;
- accessible Back control and form usability on a narrow phone screen.

Any proposed change to settlement authority, data retention, bank data handling, or payment behavior requires a separate human decision.

---

## 8. Validation Checklist

- [ ] Exactly one primary CTA is shown in Host mode.
- [ ] Existing unchanged details continue without an unnecessary write.
- [ ] Changed/new details save before the existing bill-preview success navigation.
- [ ] Invalid fields and Firebase failures preserve values and show actionable feedback.
- [ ] Bank `shortName` is primary; full name is one-line secondary; BIN is not visibly rendered.
- [ ] Selected bank BIN remains the persisted `bankId` for VietQR compatibility.
- [ ] Manual entry is accessible from the picker and can return to bank selection.
- [ ] Expiry note uses the existing actual `expiresAtUtcMs`; no expiry contract changed.
- [ ] Back control uses an icon plus label, has a 44 dp minimum touch target, and remains one row.
- [ ] No new dependency, raw color, payment schema change, or unrelated shell edit is introduced.
- [ ] TypeScript/lint or focused checks are run only when requested; report all checks accurately.

---

## Execution Command

```text
Read `prompts/redesign-room-settlement.prompt.md` and implement its approved direction in `src/screens/SettlementDetailsScreen.tsx`. Preserve ADR-020 and all payment/data contracts. Use the current conversation as the visual decision record, reuse existing components and theme tokens, apply antislop DURING implementation, and report the exact diff and checks actually performed. Do not commit or deploy.
```
