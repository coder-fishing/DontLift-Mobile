# P5.1 — Design the Software Architecture (DontLift)

> **Role:** PRIMARY
> **Skills:**
>   - `$qskill-brainstorming` (required: compare architecture trade-offs)
>   - `$react-native-expert` (supporting: mobile client boundaries)
>   - `$firebase-basics` (supporting: project setup, Firebase CLI)
>   - `$firebase-auth-basics` (supporting: auth flow, token, ownership)
>   - `$firebase-firestore` (supporting: data model, queries, listeners)
>   - `$firebase-security-rules-audit` (supporting: RBAC, Host/Member auth)
>   - `$firestore-rules-creation` (supporting: security rules creation)
> **Interaction mode:** plan-then-approve
> **Output mode:** interactive draft → approved artifact set
> **Approval gate:** approve the architecture decision before saving
> **Canonical output:**
>   - `docs/software-architecture.md`
>   - `design/system-context.mmd`
>   - `design/data-model.mmd`
>   - `design/sequence-flows.mmd`
>   - `docs/decisions/` (ADRs)
> **Run context:** fresh session; attach or provide every input below.

---

## 1. Use this when

Product behavior and selected interaction rules are accepted, and you need a small technical structure that preserves them.

Use this when:
- PRD, Feature Spec, and selected design direction are approved
- You need to design the technical architecture for DontLift
- You need to decide on Firebase structure, data model, security rules, and deployment

Do NOT use this to change product scope. Only design structure.

---

## 2. Inputs

Required:

- Project context: `docs/project-context.md`
- Product requirements: `docs/product-requirements.md`
- Feature specification: `docs/feature-specification.md`
- Accepted product design: `design/concepts/concept-final/decision-packet.md`
- Decision packet: `design/concepts/concept-final/decision-packet.md`
- Any human runtime, deployment, or technology constraint.

Context (read-only reference):

- Feature Spec Section 6 (Data Architecture, Persistence, Offline Reconciliation)
- Feature Spec Section 2 (Authorization & Protected Access)
- Feature Spec Section 3 (Room & Session Lifecycle State Machine)
- Feature Spec Section 5 (Business Rules & Mathematical Specifications)

If any input is missing, report the gap before proceeding.

---

## 3. Task

Use `$qskill-brainstorming` to compare viable options before recommending one.

Use `$react-native-expert`, `$firebase-basics`, `$firebase-auth-basics`, `$firebase-firestore`, `$firebase-security-rules-audit`, and `$firestore-rules-creation` only to assess:
- Mobile client boundaries
- API / Firestore contract
- Auth + ownership
- State management
- Offline-first sync
- Error handling
- Security rules

Draft:
- System boundaries
- Authentication (Firebase Auth)
- Ownership (users, rooms, members, violations, billShares)
- Data model (Firestore + SQLite)
- API / Firestore contract
- Error handling
- Deployment shape (Expo + Firebase)
- Risks
- ADR-worthy decisions

DontLift context to preserve:

**Tech stack (from PRD OQ-5):**
- Mobile: React Native + Expo
- Auth: Firebase Authentication (Email/Password MVP; Social Login Post-MVP v1.1)
- Backend: Firebase Firestore + Cloud Functions
- Local: SQLite (Offline-First SQLite Reconciliation)
- Payment: VietQR P2P (non-custodial)

**Session lifecycle:**
- CREATED → WAITING → ACTIVE → COMPLETED
- ACTIVE → CANCELLED (early termination vote)
- ACTIVE → ABORTED (network crash recovery)

**Penalty Score formula:**
- Score = (LiftCount × 10) + (ViolationDurationSeconds × 1)

**Domain vocabulary:**
- `Solo Focus Mode`, `Group Room Mode`, `3-Second Grace Period`, `Phone-Down Detection`, `Violation Log`, `Offline-First SQLite Reconciliation`, `VietQR P2P`, `Penalty Leaderboard`, `Host`, `Member`

**Strict exclusions:**
- No Kiosk Mode
- No In-App Wallet
- No In-App Chat
- No AI Assistant
- No automatic bank verification

Present trade-offs and wait for human approval before saving the artifact set.

---

## 4. Constraints & Source Precedence

Source precedence:

1. Human runtime/deployment/technology constraints.
2. Accepted product artifacts (PRD + Feature Spec + design).
3. Existing repository conventions.
4. AI suggestions.

Rules:

- Keep product scope fixed while designing structure.
- Use Expo, Firebase Auth, Firestore, Cloud Functions, SQLite.
- Do NOT add services, queues, collaboration roles, or infrastructure without source-supported need.
- Preserve strict exclusions: No Kiosk Mode, No In-App Wallet, No In-App Chat, No AI Assistant, No automatic bank verification.
- Use mandatory domain vocabulary.
- Report conflicts and alternatives rather than silently changing product behavior.
- Do NOT modify PRD, Feature Spec, or design brief.
- Do NOT begin P5.2.

**CRITICAL — NO AUTO COMMIT:**
- Do NOT run `git add`, `git commit`, or `git push` automatically.
- Do NOT create commits after saving files.
- Wait for explicit human instruction before any git operation.
- Present the saved files first. Human will review and commit manually.

---

## 5. Expected Output

An architecture decision package:

**Files to create:**

docs/
├── software-architecture.md ← Architecture narrative, system context, data model, API contract, deployment shape, risks
└── decisions/ ← ADRs for accepted material decisions
├── ADR-001-firebase-stack.md
├── ADR-002-offline-first-sqlite.md
├── ADR-003-vietqr-p2p.md
└── ...

design/
├── system-context.mmd ← Mermaid system context diagram
├── data-model.mmd ← Mermaid data model diagram
└── sequence-flows.mmd ← Mermaid sequence diagrams for key flows

text

**Content requirements:**

### `docs/software-architecture.md`:

1. **Architecture narrative** — overview of DontLift architecture
2. **System context** — clients, services, external systems (refer to `system-context.mmd`)
3. **Authentication** — Firebase Auth flow, token management, SecureStore
4. **Ownership model** — users, rooms, members, violations, billShares
5. **Data model** — Firestore collections + SQLite tables (refer to `data-model.mmd`)
6. **API / Firestore contract** — Firestore document schemas, Cloud Function APIs
7. **Offline-first sync** — SQLite queue, UUID idempotency, reconciliation
8. **Error handling** — network, auth, validation, permission
9. **Deployment shape** — Expo build, Firebase deploy
10. **Risks** — performance, security, scaling
11. **Open questions** — anything needing human input

### `design/system-context.mmd`:

Mermaid diagram showing:
- Mobile client (Expo)
- Firebase Auth
- Firestore
- Cloud Functions
- SQLite (local)
- VietQR (external, non-custodial)

### `design/data-model.mmd`:

Mermaid ER diagram showing:
- Firestore: users, rooms, members, violations, billShares
- SQLite: sessions, rooms, room_members, violation_logs, entitlements, app_settings

### `design/sequence-flows.mmd`:

Mermaid sequence diagrams for:
- Auth flow (Register → Login → Token)
- Solo Focus flow (Start → Violation → Sync)
- Group Room flow (Create → Join → Active → End)
- Bill Settlement flow (Enter Bill → Calculate → VietQR → Mark Paid)
- Activation flow (Enter Code → Verify → Unlock)

### `docs/decisions/ADR-*.md`:

Each ADR includes:
- Title
- Status (Accepted / Proposed / Superseded)
- Context
- Decision
- Consequences (positive + negative)
- Alternatives considered
- Source (PRD OQ-*, Feature Spec Section *)

---

## 6. Save or Update

- Do NOT save until the human approves the architecture decision.
- After approval, write only:
  - `docs/software-architecture.md`
  - `design/system-context.mmd`
  - `design/data-model.mmd`
  - `design/sequence-flows.mmd`
  - `docs/decisions/ADR-*.md`
- Do NOT create any other file.
- Do NOT modify PRD, Feature Spec, design brief, or decision packet.
- **Do NOT commit automatically. Human will commit manually.**

---

## 7. Human Review + Validation

### Human Review Required

The human must:

- Approve the selected architecture option
- Confirm deployment assumptions (Expo + Firebase)
- Approve each ADR before implementation planning begins
- Resolve open questions
- Commit changes manually after review

### Validation Checklist

- [ ] Ownership, authorization, session lifecycle, Penalty Score rules explicit
- [ ] API / Firestore contract, data model, and ADRs agree
- [ ] Offline-First SQLite Reconciliation documented
- [ ] VietQR P2P flow documented (non-custodial)
- [ ] Session lifecycle transitions documented (CREATED → WAITING → ACTIVE → COMPLETED / CANCELLED / ABORTED)
- [ ] Deployment assumptions reproducible (Expo + Firebase)
- [ ] Decisions state trade-offs and consequences
- [ ] Strict exclusions preserved (No Kiosk, No Wallet, No Chat, No AI, No auto bank verify)
- [ ] Domain vocabulary used correctly
- [ ] No unsupported features added
- [ ] No PRD, Feature Spec, or design brief modified
- [ ] All ADRs have source references
- [ ] Mermaid diagrams are valid syntax
- [ ] No P5.2 started
- [ ] **No automatic git commit performed**
