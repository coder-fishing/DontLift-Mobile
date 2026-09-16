# P4.3 — Critique and Select an Interface (DontLift)

> **Role:** REVIEW GATE
> **Skills:** `$qskill-review-plan` (required: audit concept), `$ui-ux-pro-max` (supporting: verify design system), `$qskill-brainstorming` (conditional: decision trade-off needs discussion), `$anti-slop` (required: prevent superficial selection)
> **Interaction mode:** inspect-and-report
> **Output mode:** review findings
> **Approval gate:** human accepts the selected direction before recording it
> **Updates:** `design/concepts/concept-final/decision-packet.md` after approval
> **Run context:** fresh session; attach or provide every input below.

---

## Use this when

You have a concept and need evidence-based selection rather than aesthetic preference.

---

## Inputs

- Accepted design brief: `docs/product-design-brief.md`
- Concept final: `design/concepts/concept-final/`
- Design system: `design/concepts/concept-final/design-system.md`
- Rationale: `design/concepts/concept-final/rationale.md`
- Components: `design/concepts/concept-final/components/*.md`
- Screens: `design/concepts/concept-final/screens/*.html`
- Human review notes or usability observations.

If any input is missing, report the gap before proceeding.

---

## Task

Use `$qskill-review-plan` to inspect the concept and tie findings to observable states or screenshots.

Compare across DontLift behaviors:

- Auth clarity (Login / Register)
- Error / loading states
- Scanability (timer, leaderboard)
- Status comprehension (`Phone-Down Detection`, `3-Second Grace Period`, violation)
- `Solo Focus Mode` behavior
- `Group Room Mode` behavior
- `Penalty Leaderboard` hierarchy
- `Violation Log` clarity
- Bill Allocation clarity
- `VietQR P2P` display clarity
- Activation Code input clarity
- Offline / syncing state
- Hardware / permission error
- Keyboard / touch interaction
- Narrow layout (≤375px)
- Focus / pressed states
- Reduced motion
- Recovery behavior

Use `$ui-ux-pro-max` to verify design system consistency.

Use `$anti-slop` to check for:
- Generic AI UI
- Cards everywhere without purpose
- Decorative clutter
- Overuse of glass
- Unnecessary animations
- Unsupported features
- Fake functionality

Return findings and a recommendation. Use `$qskill-brainstorming` only if the human needs to weigh a real trade-off. Do NOT record a decision until the human approves it.

---

## Constraints and source precedence

1. Human observations and approved design brief.
2. Direct audit evidence.
3. AI preference.

Rules:

- Compare DontLift behavior, not novelty or glass intensity.
- Do NOT add features or alter behavior to make a concept win.
- Separate confirmed usability risks from taste.
- Preserve strict exclusions: No Kiosk Mode, No In-App Wallet, No In-App Chat, No AI Assistant, No automatic bank verification.
- Use mandatory domain vocabulary: `Solo Focus Mode`, `Group Room Mode`, `3-Second Grace Period`, `Phone-Down Detection`, `Violation Log`, `Offline-First SQLite Reconciliation`, `VietQR P2P`, `Penalty Leaderboard`, `Host`, `Member`.
- Do NOT modify HTML/CSS files.
- Do NOT modify `design-system.md`, `rationale.md`, `components/*.md`.
- Do NOT modify PRD, Feature Spec, or design brief.
- Do NOT begin P4.4.
- Do NOT commit code

---

## Expected output

A decision packet: evidence, recommendation, rejected alternatives, risks, mitigations, and open questions.

Structure:

```markdown
# Decision Packet — Concept Final

## 1. Summary
[Overall assessment]

## 2. Prioritized Findings

| # | Evidence | Impact | Target | Smallest Correction | Status |
|---|----------|--------|--------|---------------------|--------|
| F-01 | ... | ... | ... | ... | CONFIRMED ISSUE |
| F-02 | ... | ... | ... | ... | HUMAN DECISION NEEDED |

## 3. Validation Checklist

- [ ] Interaction contract preserved
- [ ] UX states covered
- [ ] Accessibility checked
- [ ] Responsive checked
- [ ] Design system consistent
- [ ] Strict exclusions preserved
- [ ] Domain vocabulary used correctly
- [ ] Anti-slop review complete
- [ ] No unsupported features

## 4. Recommended Direction

- Recommended: Concept Final
- Rationale: ...
- Risks: ...
- Open questions: ...

## 5. Human Review Required

The human must accept, reject, or defer each finding before:
- Updating the design record
- Beginning P4.4