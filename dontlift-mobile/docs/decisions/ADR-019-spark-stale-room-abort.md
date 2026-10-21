# ADR-019: Stale room abort trên Firebase Spark

## Status

Accepted — human confirmed Firebase free-tier operation on 2026-10-21.

## Context

SL-022 needs a Host liveness signal and a transition from `ACTIVE` to `ABORTED` after 15 minutes without a confirmed heartbeat. The original plan used authenticated Cloud Functions plus a scheduled job, which would require moving the Firebase project off Spark. The app must remain usable from Expo Go without enabling billing.

## Decision

- The signed-in Host sends an online Firestore transaction heartbeat while the app is foregrounded and the room is `ACTIVE`. Rules derive identity from Auth, require active Host membership, and require `hostHeartbeatAt` and `updatedAt` to equal `request.time`.
- `startRoom` refreshes `hostHeartbeatAt` in the same transaction that starts the room, so time spent in `WAITING` does not count as Host inactivity.
- A connected room member may attempt the stale transition. Rules allow only `ACTIVE → ABORTED` when `request.time` is strictly more than 15 minutes after `max(hostHeartbeatAt, startedAt)`. The transaction sets `endedAt` to that exact cutoff and `updatedAt` to `request.time`. Using `startedAt` as a lower bound preserves compatibility with older app builds that did not refresh heartbeat in the start transaction.
- A client timer schedules the attempt from the last server heartbeat snapshot; the server Rules check remains authoritative. Foreground/reconnect also triggers a check. No background execution is promised.
- This is opportunistic on Spark: if every app is offline or suspended, the room remains `ACTIVE` in Firestore until a client reconnects and observes it. It is not a scheduled server transition.
- At abort, local lifecycle candidates and open violations are finalized at the cutoff and retained in SQLite. Events not already committed to the shared score remain local and are not uploaded after abort. Aborted rooms do not enter settlement.
- Completion, cancellation, heartbeat, and abort race through the same room document. Firestore transaction conflict plus Rules state checks allow only one terminal transition to commit.

## Consequences

### Positive

- No Cloud Functions, Cloud Scheduler, billing upgrade, or paid deployment is required.
- Auth, Host ownership, server time, stale threshold, and room transition are enforced by Firestore Rules.
- The exact liveness cutoff is stable even if a client notices late.

### Limits

- A stale room is not changed while no client is connected; status converges when a client returns.
- A foreground heartbeat can fail during network loss; the app must not report an uncommitted heartbeat as confirmed.
- Local pending group events at abort remain local-only and do not change the shared score.
- Firestore Spark quotas apply. Heartbeats are limited to foreground cadence and room transitions use online transactions.

## Source

Human direction in the SL-022 conversation, 2026-10-21: keep implementation on Firebase free tier. Related decisions: ADR-003, ADR-004, ADR-013, ADR-014, ADR-015, ADR-016, ADR-017, and ADR-018.
