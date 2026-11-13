# Direct Firestore Sync for Solo Session Summaries

**Status:** The user approved this design on 2026-11-14 for personal history data that may be submitted by the signed-in client. Implementation is in progress.

## Goal

Sync Solo summaries from SQLite and the local outbox to Cloud Firestore through the Firebase JS client SDK, removing the `syncEvents` Cloud Function call from the new Solo sync flow. A summary remains saved locally first. When online, the device signed in to the matching account writes its summary to Firestore so Solo History can read it on another device.

Solo summaries are personal history only. The account owner may submit their own numbers; Firestore Rules validate ownership and data shape but cannot prove that sensor events are genuine. These summaries must not be used for leaderboard scores, rewards, premium entitlements, or canonical group-session data.

## Current State and Architecture Change

- `createSoloSyncWorker` claims `SOLO_SESSION_COMPLETED` events from SQLite `sync_outbox`; `createSyncEventsPort` sends them through the callable `syncEvents` Function.
- The Function currently writes `users/{uid}/sessions/{sessionId}` and `users/{uid}/syncReceipts/{eventId}` in a transaction, and validates the payload, payload hash, and duplicate events.
- `firestore.rules` allows the owner to read `users/{uid}/sessions` but currently denies all client creates, updates, and deletes.
- Solo History reads `users/{uid}/sessions`; its existing reader expects duration, lift count, violation duration, penalty score, start time, and completion time.
- The repository convention and ADR-003 currently treat `syncEvents` as the authority for offline events. This design makes a narrow exception for `SOLO_SESSION_COMPLETED` only. Group commands, payments, entitlements, and other event types remain unchanged.

## Data Contract and Firestore Writes

- Keep the document path `users/{uid}/sessions/{sessionId}` so Solo History, cursor pagination, and its cache continue to work.
- Use `sessionId` as the stable document ID and idempotency key. Keep the current summary fields: `durationSeconds`, `liftCount`, `violationDurationSeconds`, `penaltyScore`, `startedAt`, `completedAt`, `payloadHash`, and `createdAt`.
- Store `startedAt` and `completedAt` as Firestore Timestamps and set `createdAt` using a server timestamp. Compute `payloadHash` using the current canonical event contract so the legacy Function can recognize the same payload during rollout.
- The direct transport first confirms that the current authenticated UID still matches the worker UID, then runs a Firestore transaction for the summary document:
  1. If the document does not exist, create it with the schema above.
  2. If the document exists with the same `payloadHash`, return success without writing again.
  3. If the ID exists with a different hash, return permanent `already-exists` and do not overwrite the document.
- The transaction and deterministic document ID make retries after a lost response idempotent. Firestore transactions require connectivity; while offline, the worker leaves the outbox event pending and retries when the app or network becomes active.

## Security Rules and Data Ownership

- An owner may read and list summaries only under their own `users/{uid}/sessions` path.
- A client may create a summary only when `request.auth.uid == uid`. Clients may not update or delete summaries.
- Rules validate the allowed fields, field types, UUID/document ID, numeric ranges, timestamp ordering, and reasonable summary limits. A client cannot write under another UID.
- `payloadHash` detects duplicates and conflicts; it does not prove data integrity. Since this is personal history, an owner may submit self-reported values for their own account.
- Before changing Rules or SDK behavior, verify that project `august-monument-508716-u0` uses Firestore Standard for its `(default)` database. This was confirmed in Firebase Console on 2026-11-14: Edition `Standard`, location `asia-southeast1`. The Firebase CLI database listing had previously failed because its refresh token expired and network access to Google was unavailable.

## Outbox, Retries, and Recovery

- SQLite session, summary, and outbox writes remain atomic and local-first. Firestore's cache does not replace the outbox.
- Worker status remains `PENDING` while offline or retryable, becomes `SYNCED` after Firestore confirms the transaction, and becomes `FAILED` for payload conflicts or permanent Rules errors.
- Add an explicit retry operation for a session: move its `FAILED` event back to `PENDING`, clear its lease, backoff, and prior error, then kick the worker. The Retry button must call this operation before syncing; calling only `kick(ignoreBackoff)` is insufficient because the current claim query selects only `PENDING` events.
- When the new transport starts, requeue legacy `FAILED` records whose `last_error_code = 'not-found'` came from the old callable. Preserve `eventId`, `sessionId`, payload, and attempt count; retry against the deterministic Firestore path so no local summary is lost.
- Do not automatically requeue every permanent error. Keep `permission-denied`, invalid payload, and collision failures as `FAILED` until Rules/data are corrected or the user explicitly retries.

## Rollout and Compatibility

- Replace the Solo worker transport with direct Firestore while preserving the worker, leases, backoff, and outbox repository contract as much as possible.
- Keep the `syncEvents` callable deployed while older app versions may still use it. The direct writer uses the same path and `payloadHash` so the legacy Function can recognize an existing document if an older client resends the same session.
- After releasing the new client and confirming that no clients depend on the callable, update the API contract, architecture docs, and ADR before considering removal of `syncEvents`. Removing the Function is not part of the initial rollout.
- Firebase CLI tools are present locally, but cloud listing cannot currently authenticate because the stored credentials expired and network access to Google endpoints is unavailable. Verify database edition and deployment state in Firebase Console before release.

## Cost

- The new client does not call a Cloud Function for Solo summaries. Each summary requires a transaction with at least one document read and at most one document write; retries read the same deterministic path.
- SQLite and the outbox continue to support offline operation. Firestore reads, writes, storage, and bandwidth still count against Firestore quotas; usage beyond no-cost quotas or features requiring billing may incur charges.
- Do not enable billing, create a database, deploy Functions, or change cloud resources beyond Firestore Rules as part of implementation. The user explicitly requested deployment of the updated Firestore Rules on 2026-11-14; no other cloud changes are authorized by that request.

## Acceptance Criteria

- Completing Solo offline still saves the summary and outbox event locally; the UI does not report `synced` before server confirmation.
- When online, the summary appears at `users/{uid}/sessions/{sessionId}` and remains readable through Solo History.
- Retrying the same event and payload succeeds idempotently; reusing an ID with a different payload is rejected without overwriting the document.
- A user cannot read or write another UID's summary; clients cannot update or delete a created summary.
- Legacy `FAILED` `not-found` events retry through direct Firestore; the Retry button moves eligible events to `PENDING` before kicking the worker.
- Offline failures retry; `permission-denied` remains `FAILED` with its error code available for diagnosis.
- Emulator coverage verifies Rules, owner boundaries, validation, retry, conflict, idempotency, and Solo History reads. Expo Go device validation confirms that a summary syncs across two installations/devices signed in to the same account.
- No changes are made to canonical group data, group scoring, settlement, Premium, or other event types.
