# Direct Firestore Sync for Solo Summaries Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use the qskill-executing-plans skill to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
> This plan is intentionally skeleton-level: it specifies files, signatures, behavior and test cases, NOT implementation code. Read the real files before writing each task's code.

**Goal:** Sync completed Solo summaries directly from the SQLite outbox to the owner’s Firestore history without calling the `syncEvents` Cloud Function.

**Architecture:** Keep SQLite and `sync_outbox` as the local-first record and retry queue. A Firebase JS SDK transport writes to the existing owner-scoped session document path in a Firestore transaction, guarded by owner-only create/read Rules and a stable payload hash. Existing worker retry behavior remains; a one-time local migration requeues legacy callable `not-found` events, and the Summary Retry action explicitly requeues a failed event before kicking the worker.

**Tech Stack:** Expo SDK 58, React Native, TypeScript, Firebase JS SDK, Cloud Firestore Standard, Expo SQLite, Jest, Firestore Emulator Suite.

**Spec:** `docs/superpowers/specs/2026-11-14-solo-direct-firestore-sync-design.md`

**Plan slug:** `2026-11-14-solo-direct-firestore-sync`; every commit for this plan starts with `[2026-11-14-solo-direct-firestore-sync]`.

## Global Constraints

- Solo summaries are personal history only; the owner may submit self-reported values. Do not use these values for leaderboard scores, rewards, premium entitlements, or canonical group-session data.
- SQLite session, summary, and outbox writes remain atomic and local-first. Firestore cache does not replace the outbox.
- Keep `users/{uid}/sessions/{sessionId}` and the fields required by Solo History.
- The direct client may create its own summary, but may not read another owner’s data or update/delete a created summary.
- Do not enable billing, create a database, deploy Firestore Rules or Functions, or change cloud resources as part of this plan.
- Verify the target `(default)` Firestore database is Standard before changing SDK behavior or Rules. If it is Enterprise, stop and revise this plan before implementation.
- Keep the `syncEvents` callable deployed for older app versions during the client rollout. Do not change group commands, settlement, Premium, or other event types.
- Add no new runtime dependency.

---

## File Map

All source paths below are relative to `dontlift-mobile/`.

| File | Responsibility in this plan |
|---|---|
| `firestore.rules` | Permit only the validated owner-created Solo summary document; continue denying update/delete and cross-owner access. |
| `src/features/sync/firestore-solo-sync-port.ts` | Implement the Solo summary transport using authenticated Firestore transactions and per-event outcomes. |
| `src/features/sync/sync-worker.ts` | Add an explicit retry-session operation while preserving the existing pending claim, lease, and backoff behavior. |
| `src/features/sync/outbox-repository.ts` | Requeue an explicitly retried FAILED summary for its owner/session. |
| `src/features/local/migrations.ts` | One-time migration to requeue only legacy Solo `not-found` failures from the callable path. |
| `src/features/solo/hooks/use-solo-session-runtime.ts` | Initialize the worker with the Firestore transport and expose its retry operation to the screen. |
| `src/app/index.tsx` | Connect the Solo Summary Retry button to the worker’s explicit retry operation. |
| `__tests__/outbox-repository.test.ts` | Exercise failed-row requeue against SQLite, including owner/session isolation. |
| `functions/tests/solo-history-rules.emulator.test.cjs` | Replace the current blanket direct-write denial expectation with the narrow owner-create contract. |
| `__tests__/firestore-solo-sync-port.test.ts` | Cover Firestore transaction outcomes, canonical hashing, and auth changes. |
| `__tests__/solo-sync.test.ts` | Cover worker-driven retry and acknowledgement after a requeued failed summary. |
| `__tests__/local-database.test.ts` | Verify the migration version and one-time recovery of legacy `not-found` summaries. |
| `docs/decisions/ADR-003-authoritative-command-boundary.md` | Record the narrow Solo personal-history exception to the current callable ingestion boundary. |
| `docs/decisions/ADR-030-solo-direct-firestore-sync.md` | Define why client-authored Solo summaries are permitted and their limits. |
| `docs/api-contracts.md` | Document direct Solo summary writes and label `syncEvents` Solo handling as legacy compatibility. |
| `docs/software-architecture.md` | Update the Solo destination and offline synchronization boundary. |
| `docs/superpowers/plans/2026-10-13-sl-012-solo-history.md` | Mark the previous server-only Solo summary write rule as superseded by ADR-030. |

## Task 1: Verify the Firestore Edition and Add Owner-Create Rules Coverage

**Files:**
- Modify: `functions/tests/solo-history-rules.emulator.test.cjs`
- Modify: `firestore.rules`

**Interfaces:**
- Consumes: Existing database `august-monument-508716-u0`, default database `(default)`, and the existing Rules emulator harness in `functions/tests/helpers/rules-emulator.cjs`.
- Produces: A Standard-edition preflight result and Rules that allow only the approved owner-created Solo summary shape.

- [ ] **Step 1: Verify the target database edition**

From `dontlift-mobile/functions`, inspect the existing Firebase database using the Firebase Console or the local CLI:

```powershell
pnpm exec firebase firestore:databases:list --project august-monument-508716-u0
pnpm exec firebase firestore:databases:get "(default)" --project august-monument-508716-u0
```

Expected: the app’s `(default)` database exists and reports `STANDARD`. If credentials/network prevent verification, stop before changing SDK behavior or Rules and ask the user to verify the edition in Firebase Console. If the database reports Enterprise, stop and revise the SDK/data-access design.

- [ ] **Step 2: Add failing Rules emulator cases**

Update `functions/tests/solo-history-rules.emulator.test.cjs`. Seed existing records through the Rules-disabled Admin context; assert client behavior through the authenticated Firebase client SDK.

Cases that must pass:

- Owner creates a valid summary at their own `users/{uid}/sessions/{sessionId}` path -> succeeds.
- Owner reads and paginates their own summaries -> succeeds.
- Anonymous user or a different UID creates/reads a summary -> denied.
- Owner creates a summary with missing/extra fields, invalid types, negative or non-safe integer values, invalid time order, inconsistent duration/penalty, malformed hash, or a client timestamp instead of `request.time` -> denied.
- Owner updates or deletes an existing summary -> denied.
- Existing history pagination ordering remains stable for tied `completedAt` values -> unchanged.

- [ ] **Step 3: Run the focused Rules test to confirm the expected failure**

From `dontlift-mobile/functions`, run:

```powershell
pnpm exec firebase emulators:exec --config ../firebase.emulator.json --project demo-dontlift-expo-go --only auth,firestore "pnpm run test:history"
```

Expected: the new valid owner-create case fails under the current deny-all write Rule; unrelated existing owner-read cases pass.

- [ ] **Step 4: Add the narrow create-only Rule**

Update the existing `match /users/{uid}/sessions/{sessionId}` block in `firestore.rules`:

1. Keep owner-only `get` and `list` access.
2. Allow `create` only when the signed-in UID matches the path UID, the document ID is the session UUID, and the document contains exactly the approved summary fields.
3. Require non-negative safe integer summary values; require Timestamp `startedAt` and `completedAt`, `completedAt >= startedAt`, duration equal to the elapsed whole seconds, and `penaltyScore = liftCount * 10 + violationDurationSeconds`.
4. Require the lowercase SHA-256 `payloadHash` shape and `createdAt == request.time`.
5. Continue denying `update` and `delete` for every client.

- [ ] **Step 5: Run focused Rules tests and regressions**

Run the focused command from Step 3 and then, from `dontlift-mobile/functions`, run:

```powershell
pnpm run test:emulators
```

Expected: all direct Solo summary Rules cases and existing Rules suites pass against the canonical `firestore.rules` file.

- [ ] **Step 6: Commit Task 1**

```powershell
git add dontlift-mobile/firestore.rules dontlift-mobile/functions/tests/solo-history-rules.emulator.test.cjs
git commit -m "[2026-11-14-solo-direct-firestore-sync] Allow owner-created Solo summaries" -m "Plan: docs/superpowers/plans/2026-11-14-solo-direct-firestore-sync.md`nTask: 1"
```

## Task 2: Implement the Direct Firestore Sync Port

**Files:**
- Create: `src/features/sync/firestore-solo-sync-port.ts`
- Create: `__tests__/firestore-solo-sync-port.test.ts`

**Interfaces:**
- Consumes: `SoloSyncWireEvent` and `SyncWorkerTransport` from `src/features/sync/sync-worker.ts`; `Firestore` and `Auth` from the Firebase JS SDK; the approved summary path and fields from the spec.
- Produces: `createFirestoreSoloSyncPort(input: { firestore: Firestore; auth: Auth; userId: string; now?: () => number }): SyncWorkerTransport`.

- [ ] **Step 1: Write failing transport tests**

Add focused Jest cases to `__tests__/firestore-solo-sync-port.test.ts`.

Cases that must pass:

- Correctly signed-in owner sends a new summary -> transaction reads `users/{uid}/sessions/{sessionId}`, creates the approved document, and returns `SYNCED`.
- The document uses `Timestamp.fromMillis` for start/completion, `serverTimestamp()` for `createdAt`, and the same canonical SHA-256 payload hash as `functions/src/sync-events.cjs`.
- Existing document has the same hash -> returns `SYNCED` without another write.
- Existing document has a different hash -> returns permanent `already-exists` and does not overwrite.
- Auth is absent or UID changed before the transaction -> no write is attempted and the event is not acknowledged.
- Firestore `permission-denied` -> permanent failed outcome; `unavailable`, `deadline-exceeded`, or `aborted` -> retryable failed outcome.
- One event’s permanent failure does not prevent other events in the same batch from returning their own outcomes.

- [ ] **Step 2: Run the focused tests to confirm the expected failure**

From `dontlift-mobile`, run:

```powershell
pnpm test -- --runTestsByPath __tests__/firestore-solo-sync-port.test.ts
```

Expected: tests fail because the new transport module does not exist.

- [ ] **Step 3: Implement the Firestore transport contract**

Add `createFirestoreSoloSyncPort` to `src/features/sync/firestore-solo-sync-port.ts`.

For each event, in order:

1. Confirm `auth.currentUser?.uid` still equals the configured `userId`; if not, return an unauthenticated outcome without touching Firestore.
2. Build the deterministic owner/session document reference and canonical event hash using the same field order and values as the legacy Function.
3. In a Firestore transaction, read the summary document before writing.
4. If absent, create the summary using the approved field mapping and server timestamp.
5. If present with the same hash, return success without writing; if the hash differs, return permanent `already-exists` without modifying it.
6. Convert Firestore errors to per-event outcomes: permission/validation/conflict errors are permanent; connectivity, deadline, aborted, and resource exhaustion errors are retryable.
  7. Return the existing `SyncWorkerTransport` envelope with one outcome per event and `serverTimeUtcMs` from the injected clock; treat that client clock value as metadata, not as authoritative server time. Do not add receipt documents or call Cloud Functions.

- [ ] **Step 4: Run transport and worker unit tests**

From `dontlift-mobile`, run:

```powershell
pnpm test -- --runTestsByPath __tests__/firestore-solo-sync-port.test.ts __tests__/solo-sync.test.ts
```

Expected: the new transport cases and existing worker acknowledgment/retry cases pass.

- [ ] **Step 5: Commit Task 2**

```powershell
git add dontlift-mobile/src/features/sync/firestore-solo-sync-port.ts dontlift-mobile/__tests__/firestore-solo-sync-port.test.ts
git commit -m "[2026-11-14-solo-direct-firestore-sync] Add direct Firestore transport" -m "Plan: docs/superpowers/plans/2026-11-14-solo-direct-firestore-sync.md`nTask: 2"
```

## Task 3: Recover Legacy Failed Rows and Make Retry Functional

**Files:**
- Modify: `src/features/local/migrations.ts`
- Modify: `src/features/sync/outbox-repository.ts`
- Modify: `src/features/sync/sync-worker.ts`
- Modify: `__tests__/local-database.test.ts`
- Modify: `__tests__/solo-sync.test.ts`
- Create: `__tests__/outbox-repository.test.ts`

**Interfaces:**
- Consumes: Existing `sync_outbox` state vocabulary and migration chain through version 15.
- Produces: Migration version 16; `requeueFailedForSession(input: { userId: string; sessionId: string }): Promise<boolean>`; and `retrySession(sessionId: string): Promise<void>` on the worker.

- [ ] **Step 1: Write failing migration and retry cases**

Add/update tests in `__tests__/local-database.test.ts` and `__tests__/solo-sync.test.ts`.

Cases that must pass:

- Migration 16 changes only `FAILED` `SOLO_SESSION_COMPLETED` rows with `last_error_code = 'not-found'` to `PENDING`, clears error/backoff/lease, and preserves event ID, payload, actor, and attempt count.
- Migration leaves `permission-denied`, invalid-payload, collision, other event types, and already-pending rows unchanged.
- Repeating the migration does not reprocess already-upgraded data.
- Repository requeue changes only the matching owner/session `SOLO_SESSION_COMPLETED` failure and returns false when no matching failed row exists.
- Requeue preserves the payload and attempt count while clearing only error, backoff, and lease state.
- Explicit retry of a failed summary moves only that user/session event to `PENDING`, clears its previous error/backoff/lease, and retains its payload and attempt count.
- Retry then kicks the worker with `ignoreBackoff` and the requested session ID; an unrelated user/session event is untouched.
- Retrying a pending or already-synced session does not corrupt its status and still safely asks the worker for its current status.

- [ ] **Step 2: Run focused tests to confirm failures**

From `dontlift-mobile`, run:

```powershell
pnpm test -- --runTestsByPath __tests__/local-database.test.ts __tests__/solo-sync.test.ts
```

Expected: version-16 and explicit failed-row retry cases fail against the current migration and worker APIs.

- [ ] **Step 3: Add migration 16 and targeted outbox requeue**

In `src/features/local/migrations.ts`, add migration 16 to requeue only legacy `SOLO_SESSION_COMPLETED` rows failed with `not-found`. Preserve the original payload and identity fields; clear `last_error_code`, `next_attempt_at`, and `lease_expires_at`; do not reset `attempt_count`.

In `src/features/sync/outbox-repository.ts`, add `requeueFailedForSession` with an owner-, session-, event-type-, and `FAILED`-scoped update. Return whether a row was requeued.

Update all migration-version expectations in `__tests__/local-database.test.ts` from 15 to 16 where they represent the latest schema.

- [ ] **Step 4: Add worker retry operation**

In `src/features/sync/sync-worker.ts`, add `retrySession(sessionId: string): Promise<void>`. It calls `requeueFailedForSession` for the worker’s configured user, then calls `kick({ ignoreBackoff: true, sessionId })`. If no failed row was requeued, it still kicks to refresh the session’s current status.

- [ ] **Step 5: Run migration and worker tests**

From `dontlift-mobile`, rerun:

```powershell
pnpm test -- --runTestsByPath __tests__/local-database.test.ts __tests__/solo-sync.test.ts
```

Expected: legacy requeue, explicit retry, auth ownership, and existing worker behavior pass.

- [ ] **Step 6: Commit Task 3**

```powershell
git add dontlift-mobile/src/features/local/migrations.ts dontlift-mobile/src/features/sync/outbox-repository.ts dontlift-mobile/src/features/sync/sync-worker.ts dontlift-mobile/__tests__/local-database.test.ts dontlift-mobile/__tests__/solo-sync.test.ts
git commit -m "[2026-11-14-solo-direct-firestore-sync] Retry failed Solo outbox events" -m "Plan: docs/superpowers/plans/2026-11-14-solo-direct-firestore-sync.md`nTask: 3"
```

## Task 4: Wire Solo Runtime and Summary Retry to Firestore

**Files:**
- Modify: `src/features/solo/hooks/use-solo-session-runtime.ts`
- Modify: `src/app/index.tsx`

**Interfaces:**
- Consumes: `createFirestoreSoloSyncPort`, worker `retrySession(sessionId)`, existing `FirebaseRuntime.firestore/auth`, and current summary/outbox state.
- Produces: Solo sync worker uses direct Firestore; the Summary screen’s Retry action invokes `retrySession`.

- [ ] **Step 1: Wire direct Firestore transport into Solo runtime**

In `use-solo-session-runtime.ts`, construct the worker with `createFirestoreSoloSyncPort({ firestore: runtime.firestore, auth: runtime.auth, userId })`. Preserve app foreground, network recovery, summary completion, status display, lease, and backoff triggers.

- [ ] **Step 2: Wire the Retry button to explicit failed-row recovery**

In `index.tsx`, change the `SoloSummaryScreen` `onRetrySync` callback from `kick({ ignoreBackoff: true, sessionId })` to the worker’s `retrySession(sessionId)`. Keep the same session-scoped UI status behavior.

- [ ] **Step 3: Run focused app tests and static checks**

From `dontlift-mobile`, run:

```powershell
pnpm test -- --runTestsByPath __tests__/firestore-solo-sync-port.test.ts __tests__/solo-sync.test.ts __tests__/local-database.test.ts
pnpm exec tsc --noEmit
pnpm exec eslint src/features/solo/hooks/use-solo-session-runtime.ts src/features/sync/firestore-solo-sync-port.ts src/features/sync/outbox-repository.ts src/features/sync/sync-worker.ts src/features/local/migrations.ts src/app/index.tsx
```

Expected: focused tests, TypeScript, and targeted lint pass. No client call to `syncEvents` remains in the Solo worker path.

If the repository's known unrelated TypeScript baseline diagnostics are present, record them before Task 4 and confirm this task adds no new diagnostics in its touched files.

- [ ] **Step 4: Commit Task 4**

```powershell
git add dontlift-mobile/src/features/solo/hooks/use-solo-session-runtime.ts dontlift-mobile/src/app/index.tsx
git commit -m "[2026-11-14-solo-direct-firestore-sync] Wire Solo sync to Firestore" -m "Plan: docs/superpowers/plans/2026-11-14-solo-direct-firestore-sync.md`nTask: 4"
```

## Task 5: Align Architecture Docs and Complete Emulator/Device Verification

**Files:**
- Modify: `docs/decisions/ADR-003-authoritative-command-boundary.md`
- Create: `docs/decisions/ADR-030-solo-direct-summary-sync.md`
- Modify: `docs/api-contracts.md`
- Modify: `docs/software-architecture.md`
- Modify: `docs/superpowers/plans/2026-10-13-sl-012-solo-history.md`
- Modify: `functions/tests/solo-history-rules.emulator.test.cjs` if Task 1 left contract coverage changes pending.

**Interfaces:**
- Consumes: Approved spec, direct transport, Rules contract, outbox migration, and worker retry behavior.
- Produces: One consistent documented Solo direct-write exception, while retaining the legacy callable for old clients.

- [ ] **Step 1: Record the ADR exception and update contracts**

Add ADR-030 stating that Solo summaries are owner-submitted personal history and are not trusted for shared/canonical decisions. Update ADR-003 to list this exception without weakening the existing callable/server boundary for all other events. Update `docs/api-contracts.md` and `docs/software-architecture.md` so they distinguish the direct Solo summary transaction from legacy `syncEvents` compatibility. Mark the direct-write denial rule in the SL-012 plan as superseded by ADR-030.

- [ ] **Step 2: Run emulator and app regression suites**

From `dontlift-mobile/functions`, run:

```powershell
pnpm exec firebase emulators:exec --config ../firebase.emulator.json --project demo-dontlift-expo-go --only auth,firestore "pnpm run test:history"
pnpm run test:emulators
```

From `dontlift-mobile`, run:

```powershell
pnpm test -- --runTestsByPath __tests__/firestore-solo-sync-port.test.ts __tests__/solo-sync.test.ts __tests__/local-database.test.ts __tests__/solo-history.test.ts __tests__/solo-history-storage.test.ts
```

Expected: owner create/read and isolation Rules cases pass; direct transport replay/conflict cases pass; migration and explicit retry pass; Solo History pagination and local-first merge remain unchanged.

- [ ] **Step 3: Perform Expo Go device validation after Rules are available**

Use an authenticated Expo Go build with the approved project and Rules available. Do not claim device success from emulator results alone.

Cases and expected results:

- Finish a Solo session offline -> summary is saved locally and remains pending.
- Restore connectivity and foreground the app -> exactly one owner summary appears in Firestore and History shows it as synced after acknowledgement.
- Start with a device containing a legacy `FAILED/not-found` row -> migration changes that Solo row to pending and it syncs without losing the local summary.
- Tap Retry on a failed summary -> its local row becomes pending before the transaction runs; status changes to synced if the transaction succeeds.
- Same session/payload is sent again -> status is synced and no duplicate document is created.
- Same session ID with a different payload -> Firestore document is unchanged and the local event reports `already-exists`.
- Sign in as another UID -> the other UID cannot read or write the first user’s summary.

- [ ] **Step 4: Do not deploy project Rules or Functions in this task**

Keep cloud deployment outside this plan, as specified by the design. After local emulator and device-ready artifacts are reviewed, provide the user the exact Rules deployment command and wait for a separate deployment request before executing it.

- [ ] **Step 5: Commit Task 5**

```powershell
git add dontlift-mobile/docs/decisions/ADR-003-authoritative-command-boundary.md dontlift-mobile/docs/decisions/ADR-030-solo-direct-summary-sync.md dontlift-mobile/docs/api-contracts.md dontlift-mobile/docs/software-architecture.md dontlift-mobile/docs/superpowers/plans/2026-10-13-sl-012-solo-history.md dontlift-mobile/functions/tests/solo-history-rules.emulator.test.cjs
git commit -m "[2026-11-14-solo-direct-firestore-sync] Document direct Solo sync boundary" -m "Plan: docs/superpowers/plans/2026-11-14-solo-direct-firestore-sync.md`nTask: 5"
```

## Plan Self-Review

- Spec coverage: local-first SQLite/outbox, direct transaction writes, owner-only Rules, same path/schema, stable hash idempotency, retryable/permanent outcomes, migration of legacy `not-found`, functional Retry action, legacy Function rollout, no cloud deployment, and Expo Go acceptance are mapped to Tasks 1–5.
- Placeholder scan: no TBD/TODO or unspecified validation/test step remains. The Firestore edition check is an explicit stop gate in Task 1.
- Interface consistency: `createFirestoreSoloSyncPort` returns the existing `SyncWorkerTransport`; `retryFailedForSession` is consumed by worker `retrySession`; `retrySession(sessionId)` is consumed by the app callback.
- Scope check: the plan changes only Solo personal-summary sync and its documentation. Group, settlement, and entitlement transports are unchanged.
