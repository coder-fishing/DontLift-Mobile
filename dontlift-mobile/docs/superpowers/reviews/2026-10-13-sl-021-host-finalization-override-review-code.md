# Review feedback — SL-021 Host finalization override

## RC-001

- **Status:** RESOLVED
- **Severity:** Medium
- **Category:** Retry lifecycle
- **Location:** `src/app/index.tsx` — completed-room history retry after leaving Group Summary
- **Problem:** The history retry listener was scoped to the Group Summary screen and selected `lobbyRoom`. Returning to Group Home removed the listener while pending group violation outbox rows remained in SQLite. A reconnect then had no active path to retry them until app restart.
- **Recommendation:** Keep history-only retries independent of the Summary screen and selected room, and retry pending completed-room events on reconnect.
- **Created At:** 2026-10-21
- **Updated By:** Codex
- **Updated At:** 2026-10-21
- **Response:** Reproduced the lifecycle gap in the existing `currentScreen === '13-group-summary'` effect and confirmed that returning home clears the selected room. Added an authenticated-session worker that scans local completed rooms with pending ROOM violation outbox rows, calls the existing authoritative Firestore reconciliation path, wakes on reconnect/app foreground, and retries remaining rows with capped exponential backoff until drained. The regular room sync path decides whether the server room is still pending or has HOST_OVERRIDE; override events stay history-only and never update frozen scores. Added repository and retry-controller regressions. TypeScript and 3 focused Jest suites (10 tests) pass. Expo Go restart/reconnect behavior remains unverified on device.

**Execution record — 2026-10-21:** `node node_modules/jest/bin/jest.js --runInBand __tests__/group-violation-repository.test.ts __tests__/completed-group-violation-sync-retry.test.ts __tests__/room-host-finalization-override.test.ts` passed (3 suites, 10 tests). `node node_modules/typescript/bin/tsc --noEmit` and `git diff --check` passed. Firestore behavior is exercised through existing repository mocks; device reconnect remains unverified.
