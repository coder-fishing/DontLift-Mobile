# Direct Firestore Sync for Solo Summaries — Execution Prompt

> **Role:** Senior React Native / Firebase engineer
> **Required skills:** `$qskill-executing-plans`, `$firebase-firestore`, `$react-native-expert`; use `$qskill-systematic-debugging` before responding to unexpected failures and `$qskill-review-code` for the final review.
> **Execution mode:** Approved implementation plan, executed task-by-task on the current branch.
> **Canonical plan:** `docs/superpowers/plans/2026-11-14-solo-direct-firestore-sync.md`
> **Approved design:** `docs/superpowers/specs/2026-11-14-solo-direct-firestore-sync-design.md`
> **Plan slug:** `2026-11-14-solo-direct-firestore-sync`

---

## Goal

Replace the Solo summary sync callable with direct, owner-scoped Firestore transactions while preserving SQLite/outbox local-first behavior, retry handling, and Solo History compatibility.

## Approval and source precedence

The user approved the design, accepted that Solo summaries are personal history and may be self-reported, and approved the implementation plan. Follow the plan without asking for another approval for ordinary implementation choices.

If requirements conflict, use this order:

1. Newer explicit user instructions.
2. The approved design spec.
3. The approved implementation plan.
4. Current Firestore Rules, ADRs, API contracts, and repository instructions.
5. This prompt.

## Mandatory preflight stop gate

Before changing any application source, Firestore Rules, schema, or runtime configuration:

1. Verify project `august-monument-508716-u0` uses Firestore Standard for the `(default)` database through Firebase Console or Firebase CLI.
2. If verification fails because of expired credentials or unavailable network, stop and ask the user to verify the edition or restore CLI access.
3. If the database is Enterprise, stop and revise the SDK/data-access design before continuing.
4. Do not infer the edition from `firebase.json`, SDK imports, or emulator behavior.

The local Firebase CLI previously failed database listing because its refresh token had expired and network access to Google endpoints was unavailable. Do not retry Firebase login, access unrelated credentials, or change cloud resources without the user's direction.

## Execution procedure

1. Read the complete approved plan, spec, applicable `AGENTS.md` files, ADR-003, and the current implementation before each task.
2. Follow plan tasks in order. Each task uses its stated focused tests first, then implementation, then verification.
3. Use Firestore Emulator tests for Rules; never use the production project for test fixtures.
4. Keep SQLite and `sync_outbox` as the local-first source and offline queue. Use `users/{uid}/sessions/{sessionId}` with the approved fields and idempotency behavior.
5. Requeue legacy Solo `FAILED/not-found` records with the planned local database migration. The Summary Retry action must requeue a failed event before kicking the worker.
6. Keep the legacy `syncEvents` callable available for older app versions. The new Solo worker must use direct Firestore and must not call it.
7. Keep Solo summaries out of leaderboards, rewards, Premium decisions, and canonical group data.
8. Do not enable billing, create databases, deploy Functions, or modify cloud resources beyond Firestore Rules. Rules deployment is authorized only by the later user authorization recorded below.
9. Work inline on the current non-main branch. Do not create a branch/worktree or spawn subagents unless the user asks.
10. Commit each completed plan task with the plan slug and required `Plan:` and `Task:` trailers. Include this prompt in a prompt-only commit without a `Task:` trailer.
11. If a task hits the edition gate, a test/toolchain blocker, or an ambiguity that changes security/data behavior, stop before guessing and report the exact blocker and required user action.

## Later user authorization

On 2026-11-14, after confirming the `(default)` database is Firestore Standard in `asia-southeast1`, the user explicitly requested: deploy the Firestore Rules and use Firestore for this sync. This supersedes item 8 only for deployment of the updated Firestore Rules. Do not deploy Functions, enable billing, create databases, or change any other cloud resources. Java is needed only for the local Emulator Suite, not for Expo Go or Rules deployment; do not block Expo Go work on installing Java.

## Completion report

After all tasks are implemented and verified, report:

- What changed and the affected files.
- Exact unit, Rules Emulator, TypeScript, lint, and Expo Go verification results.
- Any remaining device/cloud checks or baseline failures.
- Confirmation that no production Rules/Functions deployment, billing change, or other cloud resource change occurred.
