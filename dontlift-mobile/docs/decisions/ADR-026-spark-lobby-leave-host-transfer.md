# ADR-026: Leave a waiting room and transfer Host on Spark

Status: Accepted. The user requested a real Leave Room action and selected transfer to another member on 2026-11-03.

- Scope: online WAITING lobbies only. Active sessions keep the existing early-exit and termination flows.
- Member departure atomically deletes only the authenticated member document and decrements participantCount.
- Host departure atomically removes the Host, decrements the count, changes room.hostId and promotes one existing ACTIVE MEMBER to HOST. The client chooses the earliest joined member, with UID as a tie-breaker. Rules verify the eligible recipient and atomic role transfer, but do not verify ordering or complete roster enumeration.
- The client reads the roster from the server and checks its count again in the transaction. Concurrent start or roster changes reject/retry the operation. The confirmation explains automatic transfer; the transaction revalidates the actual recipient.
- If the Host is alone, the same transaction closes the WAITING room as CANCELLED with server endedAt and count zero. There is no focus session to summarize.
- Rules allow only hostId, participantCount, updatedAt, lastLeaveUid, and (when closing) status/endedAt to change. Membership updates allow only the recipient role. Only the actor's membership may be deleted.
- Absence of the actor's membership is an idempotent successful retry. Old join-command receipts cannot restore a deleted membership; rejoining uses a new request.
- PIN reservations and original creation receipts remain immutable historical records. Current hostId on the room governs future authority and capacity. A new Free Host does not eject existing members from a larger room, but further joins obey the existing Free capacity check.
- The departed device clears its room state only after cloud success and attempts local membership cleanup. Remaining devices consume the new hostId and roles from live snapshots.
- No Functions, billing change, broad write permission, or production deployment is introduced by this change. Updated Rules must be deployed before the action works against Cloud.
