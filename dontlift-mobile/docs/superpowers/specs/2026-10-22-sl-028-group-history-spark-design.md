# SL-028 — Group history on Firebase Spark

Status: APPROVED — human approved D4 and the Spark authority exception on 2026-10-22.
Date: 2026-10-22. Branch: feature/sl-028-group-history (clean at inspection).

## Scope

Add a Group history entry from Group home alongside existing Solo history. List latest sessions, open result details, distinguish local recording from frozen room score, show early-exit cutoff and explain HOST_OVERRIDE-excluded late violations. Show published share/payment metadata when authorized and available; never persist bank account details or QR URLs as history.

## D4: trigger and identity

A recording summary is produced after queued capture/lifecycle work has drained and local intervals have been reconciled through an already-observed authoritative cutoff. For EARLY_EXIT, use the earlier of earlyExitAt and any terminal endedAt. Otherwise use terminal room endedAt. Support COMPLETED, CANCELLED and ABORTED as distinct outcomes. Missing/pending server timestamps do not create completion; losing connectivity alone never ends a room.

Use (actorUid, roomId) as stable summary identity, independently of the legacy sessions table primary key. One logical GROUP_SESSION_LOCAL_SUMMARY outbox event per identity, with a stable persisted UUID event ID; repeated callbacks/restarts reuse it. SQLite migration preserves existing records. Atomically save summary and matching outbox envelope. Read committed local stats only, label them local rather than canonical scores.

If the member is offline but already has an authoritative cutoff, recording still completes locally and queues upload. If the cutoff is not known until reconnect, retain existing recovery state and defer completion. On startup recover unfinished eligible summaries before retrying the outbox, without issuing lifecycle commands.

## Spark destination and synchronization

Replace the draft syncEvents callable for this event type with a dedicated Rules-checked client transaction writing users/{uid}/groupHistory/{roomId}. Owner-only reads/listing. Write requires authenticated owner, actual ACTIVE/EARLY_EXIT membership, exact room/cutoff identity and bounded summary fields. Store personal local summary only, not a writable canonical roster/score/bill mirror. Include event ID and payload version; exact replay is a no-op and conflicting identity/payload is rejected.

History upload runs independently of the selected screen and selected room; initialization, reconnect, foreground and explicit retry can drain pending rows. Keep the event until backend success and local SYNCED commit. A failed row must not starve other rooms. Permission/invalid-payload errors remain visible as failures rather than false success.

Rules verify ownership, membership, cutoff and schema. They cannot prove the device reported every sensor event or recompute local summary totals; clearly describe the summary as device-reported. Existing finalized room member scores remain authoritative and unmodified.

## Recovery and queries

Owner path query ordered by completion time then room ID, cursor pagination, dedupe by actorUid/roomId. Load SQLite first, then merge the cloud page. Per-room detail reads use the existing membership-scoped room/member/violation/current-publication boundaries. Preserve errors, stale/cached labels and account isolation; no broad rooms list permission.

Second-device recovery restores summaries already uploaded by that account and fetches still-authorized canonical details. A recording never uploaded from any device cannot be discovered through this personal index. Bank-detail expiry and old-share access restrictions continue to apply.

## Retention decision

For this slice, show the recent seven days for Free users; Local Premium extends local visibility and verified Server Premium extends cloud history visibility according to existing entitlement separation. Keep pending/failed local records visible until resolved. This is an application visibility window for the private history index, not a claim of server-enforced deletion or a security boundary. Physical deletion/retention jobs remain SL-033. No scheduled Functions, TTL billing, or automatic data deletion is introduced.

## UI and failure handling

Reuse existing history/controller conventions, Liquid Acrylic components, semantic theme tokens and safe areas. Apply ui-ux-pro-max, react-native-expert and core antislop during implementation. Provide list/detail, empty/loading/error/offline/pending states, explicit retry and accessible touch targets. Canonical results may be pending or unavailable; local summary must never silently substitute as final score. Published bill detail must preserve revision and paid lock, and stale/expired payment data must not offer a QR.

## Verification and exclusions

Verify atomic rollback, repeated trigger, process restart, account switching, cutoff/grace handling, early exit before terminal end, independent reconnect drain, lost ACK replay, overlapping cloud pages and exact membership reads. Rules tests use local Standard Firestore Emulator on a demo project only; app remains Expo Go with Firebase Cloud. Physical two-account Android/iOS evidence is recorded separately.

No Functions, billing, production deployment, automatic room completion, bank verification, analytics dashboard, public history, or canonical score/bill recalculation. No commit/push/PR until requested.

## Approval evidence

Human answered Duyệt phương án Spark (Khuyến nghị) on 2026-10-22, approving D4/cutoff, owner index, visibility window and recovery limit. Implementation is authorized under ADR-024; no commit/push/deploy until requested.

## Human-approved extension — reopen payment from history

2026-10-22: human asked for an unpaid bill in history to reopen payment QR and then said làm đi. Show Pay my share only for the signed-in user's positive share not marked paid. A cached history value is only a navigation hint: an isolated subscription must confirm actual room, membership, publication/revision/paid counter and bank-detail expiry from Firebase before QR rendering. New publication, paid confirmation, cached snapshots, lost connectivity or revoked membership invalidates the old QR. Reuse the SL-026/027 QR screen; no payment writes or self-confirmation, no bank/QR persistence, no change to the current active room. Return to the same history detail. This supersedes the original read-only navigation exclusion, while keeping canonical payment authority unchanged.
