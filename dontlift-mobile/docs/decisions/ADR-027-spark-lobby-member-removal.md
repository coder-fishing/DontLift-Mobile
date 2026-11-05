# ADR-027: Host removes a Member from a WAITING lobby

Status: Accepted, user requested Host kick controls on 2026-11-03.

- Scope is WAITING rooms only. Active-session membership, scores and early-exit voting remain governed by their existing contracts.
- Only the authenticated current room Host with an ACTIVE HOST membership can remove an existing ACTIVE MEMBER. Self-removal uses Leave Room. No Host can be kicked.
- A single online Firestore transaction deletes the selected membership and changes only participantCount (minus one), updatedAt (server time), and lastKickUid. Rules verify all linked writes and reject standalone deletes, count edits, role changes and cross-room actions.
- A target already absent is an idempotent no-op after validating the caller and waiting room. Start/leave/removal concurrency is resolved by transaction reads and Rules.
- A server-confirmed own-membership listener returns the removed device to the Group entry screen when it is in the lobby/join flow and clears its cached membership. Cached missing documents, pending local writes, network failures and permission errors do not count as confirmed removal. Removal can only be received after the device connects.
- Kick removes membership, without a persistent ban. The confirmation states the user can rejoin with a valid PIN and a fresh join request. Previous immutable receipts do not re-create membership.
- The UI shows a minimum 48dp Host-only Remove Member action, native destructive confirmation, pending state and English error feedback. It relies on Rules for authorization, not visibility alone.
- Uses Firebase Spark without Functions. Rules deployment is required before using this capability against Firebase Cloud.
