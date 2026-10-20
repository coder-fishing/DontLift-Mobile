# Review feedback — SL-016 room lobby/start

## RC-001

- **Status:** RESOLVED
- **Severity:** Medium
- **Category:** Backward compatibility
- **Location:** `firestore.rules` — Host `WAITING → ACTIVE` precondition
- **Problem:** Room documents created before `lastStartRequestId` was introduced do not contain the field. Directly reading the absent field in Rules causes evaluation to fail, blocking Host start for those still-waiting rooms.
- **Recommendation:** Treat a missing marker as `null` for the initial start state.
- **Created At:** 2026-10-20
- **Updated By:** Codex
- **Updated At:** 2026-10-20
- **Response:** Replaced direct field access with `resource.data.get('lastStartRequestId', null) == null`. Added an Emulator Rules case that seeds a legacy WAITING room without the field and starts it as Host. TypeScript and app tests pass; the Rules Emulator case remains unverified because Java is unavailable (`Could not spawn java -version`).

## RC-002

- **Status:** RESOLVED
- **Severity:** Medium
- **Category:** Error handling
- **Location:** `src/features/rooms/room-repository.ts` — `startRoom` post-transaction readback
- **Problem:** The transaction can commit successfully, then the server readback can fail. The shared catch mapped that read error to a failed start even though the room is already ACTIVE.
- **Recommendation:** Isolate the readback failure and return the committed result with a pending timestamp.
- **Created At:** 2026-10-20
- **Updated By:** Codex
- **Updated At:** 2026-10-20
- **Response:** Wrapped only the post-commit server read in a local try/catch and return `startedAtUtcMs: null` if it fails. Added a repository regression test that simulates a read failure after a committed transaction; the focused Jest suite passes.

## RC-003

- **Status:** RESOLVED
- **Severity:** Medium
- **Category:** Realtime state
- **Location:** `src/features/rooms/room-listener.ts` — `publish`
- **Problem:** After one Firestore listener terminates with an error, a later snapshot from the other listener could publish the stale combined data as `live`, hiding the failure.
- **Recommendation:** Track terminal errors per listener and keep publishing the combined snapshot as `error`.
- **Created At:** 2026-10-20
- **Updated By:** Codex
- **Updated At:** 2026-10-20
- **Response:** Added terminal failure flags for room and member subscriptions. Updates from a surviving stream can refresh the retained snapshot, but its state remains `error`. Added a listener regression test for a roster error followed by a room update; the focused Jest suite passes.

## RC-004

- **Status:** RESOLVED
- **Severity:** Medium
- **Category:** Backward compatibility
- **Location:** `firestore.rules` — Host room create allowlist
- **Problem:** The new room create rule required `lastStartRequestId`, so an older installed client could not create a room while the updated Rules were deployed.
- **Recommendation:** Keep the marker optional for a compatibility window while requiring it to be absent or null on initial creation.
- **Created At:** 2026-10-20
- **Updated By:** Codex
- **Updated At:** 2026-10-20
- **Response:** Removed the marker from `hasAll`, retained it as the sole optional key in `hasOnly`, and validated `request.resource.data.get('lastStartRequestId', null) == null`. Added a Rules Emulator regression fixture that omits the field like the preceding app build. Static test syntax passes; Emulator execution remains UNVERIFIED because Java is unavailable.

## RC-005

- **Status:** RESOLVED
- **Severity:** Medium
- **Category:** Local persistence
- **Location:** `src/features/rooms/room-listener.ts` — member snapshot projection
- **Problem:** Realtime snapshots updated only the in-memory roster and omitted `joinedAt`, leaving the durable `room_members` projection incomplete and unable to reconcile changes after restart.
- **Recommendation:** Persist each canonical room/member snapshot, including `joinedAt`, and reconcile removed or changed members.
- **Created At:** 2026-10-20
- **Updated By:** Codex
- **Updated At:** 2026-10-20
- **Response:** Added serialized snapshot persistence to SQLite. Each complete snapshot atomically updates the room, removes the prior roster, and inserts current members with their server `joinedAt`. Incomplete timestamp snapshots are skipped and retried on a subsequent snapshot. Focused listener/projection Jest tests and TypeScript pass; physical Expo Go restart/reconnect remains unverified.

## RC-006

- **Status:** RESOLVED
- **Severity:** Medium
- **Category:** API contract
- **Location:** `src/features/rooms/room-repository.ts` — `StartedRoom` response
- **Problem:** Successful fresh and replayed start results omitted the contract's `version: 1` field.
- **Recommendation:** Include the version in the exported response type and both outcomes.
- **Created At:** 2026-10-20
- **Updated By:** Codex
- **Updated At:** 2026-10-20
- **Response:** Added `version: 1` to `StartedRoom` and both transaction outcomes. The focused start repository test now asserts the version for a fresh start and committed success; replay behavior remains covered. Focused Jest tests and TypeScript pass.

**Execution record — 2026-10-20, review feedback batch:** `pnpm test --runInBand __tests__/room-listener.test.ts __tests__/room-lobby-projection.test.ts __tests__/room-lobby-start.test.ts` passed (3 suites, 9 tests). `pnpm exec tsc --noEmit` passed. `git diff --check` passed. `node --check tests/room-create.rules.emulator.test.cjs` is required before commit. Firestore Rules Emulator was attempted both inside and outside the sandbox; the sandbox attempt was blocked reading Firebase CLI preferences, and the elevated attempt stopped because `java -version` could not be spawned. Rules behavior is UNVERIFIED. Two-device/Expo Go persistence remains UNVERIFIED. No Cloud Rules deployment or billing change was made.
