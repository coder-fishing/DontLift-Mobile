# P3.3 — Create Feature Specification

> **Role:** PRIMARY
> **Skills:** `$prd` (required), `$brainstorming` (conditional: behavior conflict or ambiguity)
> **Interaction mode:** plan-then-approve
> **Output mode:** interactive draft → approved artifact
> **Approval gate:** approve behavior before saving
> **Canonical output:** `/docs/feature-specification.md`
> **Sample correspondence:** `feature-specification.md`
> **Run context:** fresh session; attach or provide every input below.

---

## When to Use

The PRD has passed review and designers or developers need detailed behavior without guessing core rules.

---

## Inputs

- **Accepted product requirements:** `product-requirements.md`
- **Project context:** `project-context.md`
- **Any newer human-approved decision.**

---

## Task

Use `$prd` to specify:

- Registration / login (Firebase Auth, token storage)
- Protected access (Host vs Member authorization, room membership validation)
- Feature boundaries (Solo Focus Mode, Group Room Mode, Bill Settlement)
- Business rules (Penalty Score formula, grace period, bill splitting)
- The four-status lifecycle (`CREATED → WAITING → ACTIVE → COMPLETED`, with `ACTIVE → CANCELLED` for early termination)
- Main, alternative, and error flows (join room, start session, violation detection, early exit, termination vote)
- Validation (bill amount, activation code format, room PIN)
- Persistent data (SQLite schema, Firestore sync, offline queue)
- Offline-first behavior (SQLite persistence, sync reconciliation, conflict resolution)
- Required UI states (loading, empty, error, offline, syncing)

Reference `FR-*` and `US-*` identifiers where they clarify traceability.

Use `$brainstorming` **only if** behavior conflicts or an unresolved choice would alter the contract. Present a draft first and wait for human approval.

Reference `FR-*` and `US-*` identifiers where they clarify traceability.

Use `$brainstorm` **only if** behavior conflicts or an unresolved choice would alter the contract. Present a draft first and wait for human approval.

---

## Constraints & Source Precedence

1. Newer human-approved decisions.
2. Accepted PRD.
3. Project context.
4. AI suggestions.

**Rules:**
- Stay solution-light except where an accepted product decision fixes behavior.
- Include direct movement with a status-control fallback.
- Exclude password reset, email verification, SSO, social login, and board-sharing UI/API.
- Report contradictions rather than resolving them silently.

---

## Expected Output

A design- and implementation-ready feature specification.

---

## Save or Update

- After human approval, write `../docs/feature-specification.md`.
- Otherwise return complete Markdown for manual saving.

---

## Human Review Required

Confirm **success, failure, recovery, persistence, authorization, and destructive-action behavior** before accepting the artifact.

---

## Validation Checklist

- [ ] Every primary action has success and failure behavior.
- [ ] Destructive actions require intentional confirmation.
- [ ] Data survives reload.
- [ ] Unauthorized users cannot access unrelated boards or tickets.

## Execution Command

```bash
/cat prompts/create-feature-specification.prompt.md
```