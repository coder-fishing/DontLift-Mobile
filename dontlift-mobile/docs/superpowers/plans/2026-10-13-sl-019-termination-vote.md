# SL-019 — Termination vote

**Status:** APPROVED — user approved the Spark design on 2026-10-21.
**Plan slug:** `2026-10-13-sl-019-termination-vote`.
**Dependencies:** SL-017 and SL-018. **Authority:** [ADR-016](../../decisions/ADR-016-spark-termination-vote.md).

## Approved behavior and contract

- Runs on Firebase Spark through authenticated Firestore client transactions and Security Rules. No Cloud Functions, billing, scheduled cleanup, or offline queued commands.
- The single current vote is `rooms/{roomId}/terminationVotes/current`; each UID's current ballot is under `ballots/{uid}`. A later vote may replace a prior ballot at that path.
- All ACTIVE room members, including Host, are eligible. Host start initializes `activeMemberCount` from `participantCount`; an approved early exit decrements that count and the active vote denominator immediately. EARLY_EXIT membership remains in roster/history.
- Rules use server `openedAt` and `request.time` to enforce the 30-second deadline. All members must vote YES to cancel. NO or timeout leaves the room ACTIVE. If early exit makes remaining votes unanimous, that approval transaction cancels the room.
- Ballot, vote counters, room transition, and early-exit denominator changes are atomic. Offline writes are rejected/not queued.
- `CANCELLED` runs the existing local terminal projection, closes active capture at server end time, and skips bill settlement.

## Implementation scope

- Update API contract, architecture, feature specification, product design and implementation index; record the approved exception in ADR-016.
- Add the Spark vote repository, realtime vote/ballot listener, and accessible voting controls in Group Active.
- Extend `startRoom` to initialize active-member count and `decideEarlyExit` to atomically update it and the current vote.
- Extend Firestore Rules for narrowly scoped vote reads/writes, exact ballots, deadline checks, atomic unanimous cancellation, and early-exit adjustments.
- Add Rules Emulator tests for member/outsider access, NO behavior, unanimous cancellation, and forbidden direct writes; extend start/early-exit regressions.

## Acceptance cases

- [ ] Active room member can open/read a vote; outsider and unauthenticated readers cannot.
- [ ] Only one current vote exists; a new open reuses an unexpired vote and replaces an expired vote.
- [ ] Each active member can cast one immutable YES/NO ballot; replay does not increment counts; changing a ballot is denied.
- [ ] NO or timeout leaves the room ACTIVE; ballot at/after 30 seconds is rejected by Rules.
- [ ] Final eligible YES atomically sets vote and room to CANCELLED with server `endedAt`.
- [ ] Approved early exit removes the member from denominator and their YES from count; remaining unanimity cancels atomically.
- [ ] CANCELLED is projected locally as terminal and does not route to bill settlement.
- [ ] Existing room create/start/join/early-exit/group-violation Rules regressions pass.

## Verification record

Record exact command, exit code, test count, runtime versions, and actual outcomes below. Emulator checks require Java and Firebase Emulator Suite; device UI needs Expo Go verification.

- Baseline: branch `feature/sl-019-termination-vote`, clean before implementation.
- Emulator prerequisite checked 2026-10-21: Java is not available on PATH; Rules tests cannot run until Java is installed.
- Expo Go visual/device checks: pending user verification.

## Execution result

- `pnpm exec tsc --noEmit` — PASS (exit 0).
- `pnpm test --runTestsByPath __tests__/group-active-screen.test.tsx __tests__/room-lobby-start.test.ts __tests__/room-lobby-projection.test.ts __tests__/early-exit-repository.test.ts` — PASS, 4 suites / 21 tests.
- `node --check` for the termination-vote, early-exit, and room-start Rules test files — PASS (exit 0).
- `git diff --check` — PASS after removing trailing whitespace.
- Firebase Rules Emulator Suite — BLOCKED: `java` is not installed/on PATH. Rules security behavior and compilation are not verified yet.
- `pnpm run lint` — BLOCKED: no ESLint config exists; Expo's attempted setup failed with `AggregateError [EACCES]` while connecting.
- Expo Go on physical device — pending user verification; Cloud Rules have not been deployed.
