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
