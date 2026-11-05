# ADR-028 — Lịch sử nhóm trong History của từng thành viên

Trạng thái: Accepted, human approved 2026-11-04.

Supersedes only ADR-024's statement that the owner-only `groupHistory` index is the sole discovery path for group rooms. ADR-024's personal summary/outbox, sync, retention, payment, canonical scoring and Rules boundaries remain unchanged.

## Decision

- Every account that creates or joins a room gets an owner-scoped `users/{uid}/groupRooms/{roomId}` lookup index containing only `roomId` and the canonical membership `joinedAt` timestamp.
- The client writes the index after create/join has committed. This is a best-effort follow-up write so a Rules rollout cannot make room creation/join fail. History may repair a missing index only for a room already present in this device's local room projection.
- Rules permit the owner to list/read their index. Create requires the matching room and the owner's ACTIVE/EARLY_EXIT membership after the write, plus exact agreement with the member's `joinedAt`. Cross-owner writes and reads remain denied.
- The signed-in member's History screen loads only their index, then reads each terminal room and their own eligible membership. The shared detail uses the existing room roster, canonical member scores, published bill and payment checks.
- If an owner has no personal local summary, History can project a display entry from their own canonical room member counters and server room timestamps. This is a read projection only: it does not write a personal `groupHistory` record, alter outbox state or change score/bill authority.
- A personal summary/outbox row takes precedence for the account's own device recording. Shared room result rows are identified separately in UI and local cache.
- Local shared-history cache contains roster/score and existing safe bill summary only; no bank account details or QR payload.

## Consequences and limits

- All current eligible room members can find the same ended room in their own History tab and review the shared roster/result. Only members can load details; Host-only actions remain unchanged.
- A member's index write can fail without invalidating successful create/join. Reconnect/History refresh can repair known memberships.
- A new device can restore indexed rooms. A legacy room without an index can only be discovered if the current device has a local room/member projection; the app does not query all rooms or other users' histories.
- Firebase Spark remains supported. No Cloud Function, billing, public history collection, broad membership query, canonical score mutation or retention change is introduced.
- Existing `users/{uid}/groupHistory/{roomId}` remains the private device-reported local summary. It is not treated as a room-wide feed.

## Security checks

- Owner can create/read/list only their own group-room index.
- An index cannot be created with a different UID, room ID or joined timestamp.
- A user without current eligible room membership cannot create a new index or read room detail.
- Outsiders cannot read room indexes, roster, bill or payment data.
