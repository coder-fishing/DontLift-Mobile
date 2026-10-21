# ADR-020: Settlement details on Firebase Spark

## Status

Accepted — human approval on 2026-10-21 to keep SL-023 on Firebase Spark without enabling billing or deploying Cloud Functions.

## Context

The original SL-023 draft assigns settlement-detail writes to a callable Function and scheduled deletion. Both conflict with the requirement to keep this app on Firebase Spark. Settlement data is sensitive, room-scoped, and should become visible only after the shared score is final.

## Decision

- The signed-in Host writes `rooms/{roomId}/settlementDetails/current` with a Firestore transaction. Rules allow create/update only when the room is `COMPLETED`, reconciliation is `FINALIZED`, the caller owns the room, and the caller has an active `HOST` membership.
- Rules require an exact field allowlist: `bankId` (1–32 characters), `accountNumber` (1–64), `accountName` (1–100), `updatedAt`, and `expiresAt`. The client trims whitespace. The Host may choose a bank from VietQR's public bank directory; the selected bank's six-digit BIN is stored in `bankId` for future QR generation. Manual bank identifiers remain supported.
- `updatedAt` must equal server `request.time`. `expiresAt` is exactly `room.endedAt + 30 days`, preserving Firestore timestamp precision. No device clock participates in authorization or expiry.
- Any active room member may get the current document while its expiry is later than server `request.time`; an absent document may be read so the UI can show that the Host has not entered details yet. Outsiders, cross-room reads, expired reads, collection listing, and client deletion are denied.
- A retry upserts the same document with the same values. There is no separate receipt. The screen reports success only once the transaction resolves. Commands are online-only and are not queued offline.
- Bank details are not stored in SQLite and are never included in logs or analytics. No QR is generated in this slice. The Host may choose a bank from VietQR's public bank list; the six-digit BIN is saved as `bankId` for later QR generation. This does not perform account-name lookup or call a credentialed API.
- Expiry is logical: Rules hide the details after 30 days. Physical deletion is deferred to SL-033; this ADR does not promise scheduled cleanup on Spark.

## Consequences

### Positive

- SL-023 runs in Expo Go on Firebase Spark with no Functions deployment, scheduler, or billing upgrade.
- Auth, Host role, finalized room state, field bounds, and expiry are checked by Firestore Rules using server state/time.
- Room members can read details through a direct document get; outsiders cannot enumerate the collection.

### Limits

- Firestore Rules provide authorization, not server-side normalization; the client trims fields and Rules bound the accepted values.
- A connected client is required for save/read. No offline bank-detail write is queued.
- Expired documents remain stored until a later approved retention/purge slice.
- Firebase CLI credentials for the cloud project must be valid before anyone can deploy the updated Rules; this implementation does not deploy.

## Source

Human direction in the SL-023 conversation, 2026-10-21: keep the implementation on Firebase Spark/free tier. Related decisions: ADR-003, ADR-004, ADR-005, ADR-017, ADR-018, and ADR-019.
