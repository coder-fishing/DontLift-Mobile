# P2.1 — Build Reusable Project Context (DontLift)

> - **Role:** Senior Mobile System Architect & Context Engineering Agent
> - **Skills:** `$brainstorm` (conditional: resolve edge-case ambiguities)
> - **Interaction mode:** plan-then-approve
> - **Output mode:** interactive draft → approved artifact
> - **Approval gate:** confirm unresolved decisions before saving
> - **Inputs:** 
>   - Approved Brief: `../docs/project-brief.md`
>   - Human decisions newer than brief
> - **Canonical Output:** `../docs/project-context.md`

## Task
Extract product boundaries, core orientation/sensor mechanics, offline-first SQLite rules, P2P VietQR settlement constraints, domain vocabulary, source hierarchy, and excluded non-goals from `../docs/project-brief.md` into a portable, reusable context package saved at `../docs/project-context.md`.

## Domain Constraints & Anti-Feature-Creep Rules
- **Mandatory Domain Vocabulary:** Use `Solo Focus Mode`, `Group Room Mode`, `3-Second Grace Period`, `Phone-Down Detection`, `Violation Log`, `Offline-First SQLite Reconciliation`, `VietQR P2P`, `Penalty Leaderboard`, `Host`, `Member`.
- **STRICT EXCLUSIONS (Reject immediately if requested):**
  - REJECT any `Kiosk Mode` or invasive Device Admin / OS lock-down privileges.
  - REJECT any `In-App Wallet`, payment gateway custody, or handling of real funds inside the app.
  - REJECT `In-App Chat`, social feeds, or friend management systems.
- **Sensor & Sync Rules:**
  - Enforce the 3-second grace period for accelerometer flip-up events to avoid table vibration false positives.
  - Require SQLite local persistence for all violation logs when offline, with automatic reconciliation upon reconnection.

## Source Precedence
1. Newer human-approved decisions.
2. The approved project brief (`../docs/project-brief.md`).
3. AI suggestions.

## Expected Output Format (`../docs/project-context.md`)
A compact Markdown document classifying information into:
1. **Product Boundary & Core Mechanics** (Solo & Group modes, phone-down detection)
2. **Fixed System Constraints** (Hardware sensors, Offline-first SQLite, VietQR P2P)
3. **Approved Decisions vs. Assumptions vs. Open Questions**
4. **Domain Vocabulary & Strict Exclusions**
5. **Source Hierarchy**

## Human Review Gate
Present the draft to the human. Do NOT save to `../docs/project-context.md` until the human confirms that every `decision` is approved and no `open question` was silently closed.

## Execution Command
```bash
/cat prompts/build-project-context.prompt.md
```
Execute this prompt using `/cat prompts/build-project-context.prompt.md` to start building reusable project context.