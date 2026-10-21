# ADR-016: Termination vote on Firebase Spark

## Status

Accepted — human approval 2026-10-21.

## Context

SL-019 needs an early termination vote. Cloud Functions deployment would require Blaze billing, while the project must remain on Firebase Spark.

## Decision

- `openTerminationVote` and `castTerminationVote` are online Firestore client transactions authorized by narrowly scoped Security Rules. No Functions, billing change, or scheduled cleanup is used.
- One current vote is stored at `rooms/{roomId}/terminationVotes/current`; ballots are at `rooms/{roomId}/terminationVotes/current/ballots/{uid}`. A ballot records the current `voteId`, request ID, choice and server timestamp. A ballot for a later vote may replace the prior vote's ballot at that UID path.
- Each ACTIVE room member, including the active Host, is eligible to cast one immutable YES/NO ballot per vote. A vote starts with `eligibleVoterCount == rooms.activeMemberCount`; a NO keeps the vote open until its 30-second deadline.
- `openedAt` is a server timestamp. Rules use `request.time` to reject writes at or after `openedAt + 30 seconds`; the client countdown is display-only.
- A vote cancels the room only when every currently eligible member has voted YES before expiry. The final YES atomically marks the vote CANCELLED and the room CANCELLED with server `endedAt`.
- Host approval of a Member's early exit atomically decrements `activeMemberCount`, the current unexpired vote's eligible count, and its YES count if that Member voted YES. If the remaining eligible roster is already unanimous, that transaction also cancels the room. EARLY_EXIT membership remains in the roster/history.
- Starting a room initializes `activeMemberCount` from `participantCount`. Older clients may still start without the optional field; those legacy ACTIVE rooms cannot vote. Early exit in a legacy room without this field keeps its prior request/member behavior without voter-count writes.
- Expired vote documents are inert. A later opening may replace the current vote and its per-UID ballot records; no scheduled deletion is needed.

## Consequences

- SL-019 remains usable on Spark; Firestore quotas and Security Rules access-call limits apply.
- Rooms already ACTIVE before a compatible start wrote `activeMemberCount` cannot use SL-019. The implementation fails closed instead of guessing the current roster from device cache.
- The client must be online to open or cast a ballot. Offline writes are not queued.
- Emulator Suite tests must cover read scope, atomic transitions, replay, deadline, early-exit denominator changes, and denial of direct authoritative writes.
- Cancellation uses the existing terminal room projection and bypasses bill settlement.

## Source

Human approval in the SL-019 conversation, 2026-10-21. Related decisions: [ADR-003](ADR-003-authoritative-command-boundary.md), [ADR-013](ADR-013-spark-room-start.md), [ADR-015](ADR-015-spark-early-exit.md).
