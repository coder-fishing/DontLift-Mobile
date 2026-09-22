# P5.2 — Review the Software Architecture (DontLift)

> **Role:** REVIEW GATE
> **Skills:**
>   - `$qskill-review-code` (required: traceability and risk review)
>   - `$firebase-security-rules-audit` (supporting: verify RBAC + security rules)
>   - `$qskill-brainstorming` (conditional: a confirmed trade-off needs a human decision)
> **Interaction mode:** inspect-and-report
> **Output mode:** review findings
> **Approval gate:** accept findings before modifying canonical architecture artifacts
> **Updates:** architecture package after human review
> **Run context:** fresh session; attach or provide every input below.

---

## 1. Use this when

An architecture package is drafted and needs a boundary, contradiction, and avoidable-complexity review before code planning.

Use this when:
- P5.1 has produced the architecture package
- You need to audit traceability, auth, ownership, persistence, API/data-model consistency, error handling, deployment assumptions
- You need to catch contradictions before implementation planning begins

Do NOT use this to add features. Only audit.

---

## 2. Inputs

Required:

- Product requirements: `docs/product-requirements.md`
- Feature specification: `docs/feature-specification.md`
- Accepted product design: `design/concepts/concept-final/decision-packet.md`
- Architecture package:
  - `docs/software-architecture.md`
  - `design/system-context.mmd`
  - `design/data-model.mmd`
  - `design/sequence-flows.mmd`
  - `docs/decisions/ADR-*.md`

Context (read-only reference):

- Feature Spec Section 2 (Authorization & Protected Access)
- Feature Spec Section 3 (Room & Session Lifecycle State Machine)
- Feature Spec Section 5 (Business Rules & Mathematical Specifications)
- Feature Spec Section 6 (Data Architecture, Persistence, Offline Reconciliation)
- PRD Section 13 (Strict Exclusions)

If any input is missing, report the gap before proceeding.

---

## 3. Task

Use `$qskill-review-code` to inspect the architecture package.

Audit each of the following:

### 3.1 Traceability

- Every architecture claim traces to a behavior in PRD or Feature Spec
- Every ADR has source references (PRD OQ-*, Feature Spec Section *)
- Every Firestore collection + SQLite table maps to a User Story or Functional Requirement
- No invented components without source

### 3.2 Auth & Ownership

- Firebase Auth flow matches PRD US-01, US-02
- Token storage in SecureStore matches Feature Spec Section 1.1
- Ownership model for rooms, members, violations, billShares is explicit
- Host vs Member permissions documented
- RBAC matches Feature Spec Section 2.1

### 3.3 Persistence & Sync

- Firestore collections match Feature Spec Section 6.2
- SQLite tables match Feature Spec Section 6.1
- Offline-First SQLite Reconciliation documented (Feature Spec Section 6.3)
- UUID idempotency documented
- Sync status (PENDING, SYNCED, FAILED) documented
- No data model contradiction between Firestore and SQLite

### 3.4 Business Rules

- Penalty Score formula matches PRD OQ-1 + Feature Spec Section 5.1
- Hybrid Bill Allocation documented (Feature Spec Section 5.2)
- 3-Second Grace Period documented
- Session lifecycle (CREATED → WAITING → ACTIVE → COMPLETED / CANCELLED / ABORTED) documented

### 3.5 API / Firestore Contract

- Firestore document schemas consistent
- Cloud Function triggers documented
- API contract, data model, and ADRs agree
- No missing collections or tables

### 3.6 Error Handling

- Network error recovery documented
- Auth error handling documented
- Validation error handling documented
- Permission error handling documented
- Offline error handling documented

### 3.7 Deployment

- Deployment shape reproducible (Expo + Firebase)
- No missing environment variables
- No missing Firebase setup steps
- Build pipeline documented

### 3.8 Avoidable Complexity

- No unnecessary services, queues, or infrastructure
- No vendor lock-in beyond what PRD requires
- No over-engineering

### 3.9 Strict Exclusions

- No Kiosk Mode
- No In-App Wallet
- No In-App Chat
- No AI Assistant
- No automatic bank verification

### 3.10 Domain Vocabulary

- `Solo Focus Mode`
- `Group Room Mode`
- `3-Second Grace Period`
- `Phone-Down Detection`
- `Violation Log`
- `Offline-First SQLite Reconciliation`
- `VietQR P2P`
- `Penalty Leaderboard`
- `Host`
- `Member`

### 3.11 Findings Format

For each finding, provide:

- **Evidence:** what in the architecture package triggers the finding
- **Impact:** why it matters
- **Target artifact:** which file needs correction
- **Smallest correction:** minimal change to resolve
- **Status:** `CONFIRMED ISSUE` or `HUMAN DECISION NEEDED`

### 3.12 Anti-Slop Review

Check for:
- Generic AI architecture
- Over-abstraction
- Unnecessary complexity
- Fake functionality
- Unsupported features

Return findings first. Do NOT modify artifacts until human accepts findings.

---

## 4. Constraints & Source Precedence

Source precedence:

1. Accepted product artifacts and human decisions.
2. Architecture package.
3. AI suggestions.

Rules:

- Do NOT add product features while reviewing.
- Separate a confirmed contradiction from an implementation question.
- Preserve explicit runtime constraints unless a human decision changes them.
- Do NOT modify PRD, Feature Spec, or design brief.
- Do NOT begin P5.3.
- Use mandatory domain vocabulary.
- Preserve strict exclusions.

**CRITICAL — NO AUTO COMMIT:**
- Do NOT run `git add`, `git commit`, or `git push` automatically.
- Do NOT create commits after modifying files.
- Wait for explicit human instruction before any git operation.
- Present findings first. Human will review and commit manually.

---

## 5. Expected Output

A prioritized finding list.

Structure:

```markdown
# P5.2 Review Findings — DontLift Architecture

## 1. Summary
[Overall assessment]

## 2. Prioritized Findings

| # | Evidence | Impact | Target | Smallest Correction | Status |
|---|----------|--------|--------|---------------------|--------|
| F-01 | ... | ... | ... | ... | CONFIRMED ISSUE |
| F-02 | ... | ... | ... | ... | HUMAN DECISION NEEDED |

## 3. Validation Checklist

- [ ] Every architecture claim traces to behavior or accepted decision
- [ ] API, schema, and decision records agree
- [ ] Risks and non-goals remain visible
- [ ] Auth & ownership explicit
- [ ] Persistence & sync documented
- [ ] Business rules correct
- [ ] Error handling documented
- [ ] Deployment reproducible
- [ ] No avoidable complexity
- [ ] Strict exclusions preserved
- [ ] Domain vocabulary used correctly
- [ ] No unsupported features
- [ ] No auto commit performed

## 4. Human Review Required

The human must accept, reject, or defer each finding before:
- Modifying architecture artifacts
- Updating ADRs
- Beginning P5.3
```

Draft findings first. Present for approval before modifying artifacts.

---

## 6. Save or Update

- Do NOT save findings as a canonical file unless the human explicitly asks.
- After human approval, apply only accepted corrections to:
  - `docs/software-architecture.md`
  - `design/system-context.mmd`
  - `design/data-model.mmd`
  - `design/sequence-flows.mmd`
  - `docs/decisions/ADR-*.md`
- Do NOT create a separate review file unless requested.
- Do NOT modify PRD, Feature Spec, or design brief.
- **Do NOT commit automatically. Human will commit manually.**

---

## 7. Human Review + Validation

### Human Review Required

The human must:

- Accept, reject, or defer every material correction
- Approve any proposed ADR change
- Commit changes manually after review

### Validation Checklist

- [ ] Every architecture claim traces to behavior or an accepted decision
- [ ] API, schema, and decision records agree
- [ ] Risks and non-goals remain visible
- [ ] Auth & ownership explicit
- [ ] Persistence & sync documented
- [ ] Business rules correct (Penalty Score, Hybrid Bill, Grace Period, Lifecycle)
- [ ] Error handling documented
- [ ] Deployment reproducible
- [ ] No avoidable complexity
- [ ] Strict exclusions preserved
- [ ] Domain vocabulary used correctly
- [ ] No unsupported features added
- [ ] No PRD, Feature Spec, or design brief modified
- [ ] No separate review file created (unless requested)
- [ ] No P5.3 started
- [ ] **No automatic git commit performed**