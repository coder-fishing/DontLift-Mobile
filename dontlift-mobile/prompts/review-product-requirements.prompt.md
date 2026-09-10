# P3.2 — Review Product Requirements

> **Role:** REVIEW GATE
> **Skills:** `$prd` (required: PRD completeness and structure), `$brainstorming` (conditional: a finding needs a product decision)
> **Interaction mode:** inspect-and-report
> **Output mode:** review findings
> **Approval gate:** accept findings before changing the canonical PRD
> **Updates:** `chapter-03-ai-for-requirements-product-analysis/docs/product-requirements.md` after human review
> **Run context:** fresh session; attach or provide every input below.

---

## When to Use

You have a PRD draft and need to decide whether it is ready to drive a feature specification.

---

## Inputs

- **PRD draft:** `product-requirements.md`
- **Project context:** `project-context.md`
- **Any newer human-approved product decision.**

---

## Task

Use `$prd` to inspect requirement completeness and testability. Review:

- Product value
- Source support
- Registration / login
- Permission clarity
- Validation
- Error recovery
- Persistence
- Terminology
- Exclusions

Return **findings first**. For every confirmed issue, give the **smallest correction** and distinguish it from an **open human question**. Use `$brainstorm` only to resolve a material product choice with the human. Do **NOT** rewrite the canonical PRD until the human accepts the findings.

---

## Constraints & Source Precedence

1. Newer human-approved decisions.
2. Project context.
3. PRD draft.
4. AI suggestions.

**Rules:**
- Do not reward document length or add features while reviewing.
- Preserve accepted exclusions.
- Reject password reset, SSO, sharing, and unsupported scope unless a supplied decision approves it.

---

## Expected Output

A prioritized **findings list** containing:

| Field | Description |
|-------|-------------|
| **Evidence** | What in the PRD triggers the finding |
| **Impact** | Why it matters |
| **Target Section** | Which PRD section to fix |
| **Smallest Correction** | Minimal change to resolve |
| **Status** | `CONFIRMED ISSUE` or `HUMAN DECISION NEEDED` |

---

## Save or Update

- Do **NOT** create a separate canonical review document.
- After human approval, apply accepted corrections to `product-requirements.md`.
- Leave rejected or deferred findings **out** of the PRD.

---

## Human Review Required

The human **accepts, rejects, or defers** each finding before the PRD changes.

---

## Validation Checklist

- [ ] No requirement depends on MCP.
- [ ] No planned feature is presented as delivered.
- [ ] Main and failure journeys are testable.
- [ ] Terminology is consistent.