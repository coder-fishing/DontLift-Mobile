# SL-024 chunked bill publication Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use the qskill-executing-plans skill to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
> This plan is intentionally skeleton-level: it specifies files, signatures, behavior and test cases, NOT implementation code. Read the real files before writing each task's code.

**Goal:** Allow a finalized room with a large roster to publish a complete bill on Firebase Spark while Rules authorize each recipient and members see all shares only after final publication.

**Architecture:** Create a room-scoped preparation manifest and lock in a small Rules-checked transaction. Stage member-validated shares in sequential transactions of at most eight recipients, then atomically publish the room metadata, preparation status, and immutable receipt. The app resumes the persisted preparation after interruption; staged shares remain unreadable to members.

**Tech Stack:** Expo SDK 57, TypeScript, Firebase JS SDK, Firestore Standard, Firestore Security Rules, Firebase Emulator Suite.

**Spec:** `docs/superpowers/specs/2026-10-22-sl-024-chunked-bill-publication-design.md`

**Plan slug:** `2026-10-22-sl-024-chunked-publication` — every commit for this plan starts with this slug if/when the user requests commits.

## Global Constraints

- Firebase Spark only; do not enable billing, deploy Functions, or add paid services.
- Each share write must verify an active Host and the target's ACTIVE or EARLY_EXIT room membership.
- Members cannot read any share until the complete result is published.
- Preserve the `billShares/{uid}` path and immutable `billCommands/{requestId}` receipt.
- Keep Host-calculated share math and roster completeness as client attestations under ADR-021.
- Do not commit, push, or create another PR unless the user requests it.

---

## File Map

| File | Responsibility |
|---|---|
| `src/features/settlement/bill-repository.ts` | Prepare/resume, stage bounded share groups, finalize, and replay published results. |
| `firestore.rules` | Validate preparation lock, each staged recipient, hidden reads, and final publication linkage. |
| `functions/tests/bill-shares-rules.emulator.test.cjs` | Verify large rosters, member authorization, staged invisibility, and final publication. |
| `__tests__/bill-repository.test.ts` | Verify interrupted retries, conflicting state, and receipt replay, following existing repository test conventions. |
| `docs/api-contracts.md`, `docs/decisions/ADR-021-spark-default-bill.md`, `docs/superpowers/plans/2026-10-13-sl-024-default-bill.md` | Describe chunked staging and the final atomic visibility boundary. |

## Task 1: Protect the preparation and publication transitions

**Files:**
- Modify: `firestore.rules`
- Test: `functions/tests/bill-shares-rules.emulator.test.cjs`

- [x] Add Emulator cases for member read denial during preparation, exact Host read of staged shares, member denial for a non-member share, atomic final publication, and a 25-member roster.
- [ ] Run `pnpm --dir functions run test:emulators` before the Rules changes. Blocked because the machine has no Java runtime (`Could not spawn java -version`); production Rules were not deployed.
- [x] Add Rules transitions: create `billPreparations/current` and reserve the room request/amount/count atomically; create shares only while that preparation is active and only for listed UIDs with ACTIVE or EARLY_EXIT membership; allow the Host exact reads needed for resume; keep member share and receipt reads gated until final publication; atomically mark room and preparation published while creating the immutable receipt.
- [x] Extend the Emulator helper to stage chunks of at most eight shares, then publish in the final transaction. Keep direct partial writes, unauthorized recipients, cross-room reads, and post-publication mutation denied.
- [ ] Run `pnpm --dir functions run test:emulators`. Blocked because Java is missing; the Emulator suite could not execute.

## Task 2: Make the Host repository resumable and access-budgeted

**Files:**
- Modify: `src/features/settlement/bill-repository.ts`
- Test: `__tests__/bill-repository.test.ts`

- [x] Add repository cases for interruption after preparation, interruption after a committed chunk, retry with a new request ID and the same bill total, conflicting totals, published replay, and conflicting staged share data.
- [x] Run focused repository tests against the previous implementation to confirm it cannot resume staged publication.
- [x] Implement `publish(command, rosterMemberUids)` as prepare-or-resume, read finalized member scores outside the transaction, calculate the canonical result, write groups of at most eight shares with idempotent equality checks, then finalize room/manifest/receipt atomically.
- [x] On a pending preparation, use its saved request ID and total. Reject a different total, UID roster, or conflicting existing share. When final publication already succeeded, return the immutable receipt and saved shares.
- [x] Run focused repository/allocation tests and `node node_modules/typescript/bin/tsc --noEmit` from `dontlift-mobile`. All passed.

## Task 3: Update the published contract and run the full focused verification

**Files:**
- Modify: `docs/api-contracts.md`
- Modify: `docs/decisions/ADR-021-spark-default-bill.md`
- Modify: `docs/superpowers/plans/2026-10-13-sl-024-default-bill.md`

- [x] Replace the single-transaction wording with prepare, bounded staging transactions, and one atomic visibility/publish transaction. State clearly that membership of each staged UID is still Rules-checked and roster completeness/math remain Host attestations.
- [x] Document retry/resume, the eight-share chunk limit, hidden staging reads, the immutable final receipt, Spark-only behavior, and the no-billing/no-Functions constraint.
- [x] Run the focused bill repository and allocation suites, TypeScript check, and `git diff --check`.
- [ ] Run the Firestore Emulator suite; blocked because Java is missing.
- [x] Record the Java blocker. No production Rules deployment or commit/push was performed.
