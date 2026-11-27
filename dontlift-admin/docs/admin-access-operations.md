# Admin access operations

This document covers the trusted Node.js operator CLI. It is not a dashboard function. The CLI changes only the Firebase Auth `admin` custom claim and, for revocation, refresh-token validity. It does not alter mobile profiles, account enablement, Premium, payments, orders, receipts, or package catalog data.

## Environment and operator identity

- Run from the `dontlift-admin` directory on an approved operator workstation or controlled CI runner.
- Set `ADMIN_OPERATOR_MODE` and `ADMIN_OPERATOR_PROJECT_ID` explicitly. For local work, use only the `demo-dontlift-admin` project with the paired loopback Auth and Firestore emulators. For a connected environment, use the approved exact project and Application Default Credentials (ADC).
- `--operator` is an audit reference, not an authentication factor. The operator reference must be traceable to the person or automation represented by the ADC identity. Restrict ADC/IAM and CLI access accordingly.
- Confirm the selected project before each mutation. Never put credentials, tokens, or secret values in command-line arguments, `.env.local` tracked files, output, or screenshots.
- No other privileged process may update the same user's custom claims while this CLI command is in progress. The Firestore lock coordinates this CLI's own writers; it cannot fence Firebase Console users or unrelated privileged services.

## Read-only commands

`pnpm admin:access -- inspect --project <project-id> --uid <exact-uid>` reads the exact Auth identity and returns only enabled/admin booleans and identifiers.

`pnpm admin:access -- status --project <project-id> --command-id <uuid>` reads the recorded command and current admin claim. A successful status read only means that status was read; inspect the command's own outcome and effects before taking further action. Status never resumes work.

## Grant

Before granting access, confirm the exact UID and intended project with the owner. Assign a new UUID as `--command-id`, provide a bounded single-line `--reason`, and use an operator reference bound to the trusted execution identity. Apply is intentionally explicit:

`pnpm admin:access -- grant --project <project-id> --uid <exact-uid> --operator <operator-reference> --reason <reason> --command-id <uuid> --apply`

The CLI writes the command intent, event, and target lock before calling Firebase Auth. It reads current claims, adds only `admin: true`, then verifies current Auth state. Existing unrelated claims are preserved. An already-admin identity is reported unchanged only after verified readback and audit completion. Users need a refreshed ID token to see a newly granted claim in a session.

## Revoke

Firebase refresh-token revocation is account-wide. It can sign the same identity out of DontLift Mobile and other clients. Communicate this before every revoke. Revoke removes only `admin`, then calls refresh-token invalidation even if `admin` was already absent. It verifies both the role state and the invalidation cutoff; it does not promise that already-authorized requests stop or that every client observes the change immediately.

`pnpm admin:access -- revoke --project <project-id> --uid <exact-uid> --operator <operator-reference> --reason <reason> --command-id <uuid> --apply`

## Partial outcomes and recovery

The target lock has no automatic expiry or takeover. `partial`, `unknown`, a process interruption, or an audit write failure after an Auth effect requires investigation. Do not issue a new grant/revoke for that UID while the lock exists.

1. Read `status` and inspect its recorded events. Do not treat a current claim observation as proof that a particular timed-out Auth call succeeded.
2. Establish that the original CLI process and any worker capable of resuming it have stopped. Do not infer this from elapsed time or a stale terminal window.
3. Inspect current Auth state and the outstanding recorded steps. Confirm that another privileged claims writer did not act concurrently.
4. Only then run `reconcile` for the existing command ID, with the exact project, operator reference, `--apply`, and `--prior-worker-stopped`. Reconciliation re-reads current claims; it does not replay an old claim map or blindly release the lock.
5. Read status again. A lock is released only in the same Firestore transaction that records a verified terminal result. If verification or recording fails, preserve the lock and escalate through the operator runbook.

Example form (replace every placeholder with reviewed values):

`pnpm admin:access -- reconcile --project <project-id> --command-id <uuid> --operator <operator-reference> --apply --prior-worker-stopped`

The CLI flag records the operator's explicit assertion; it does not independently prove that a process stopped. Operators must preserve the evidence/provenance for that determination outside the CLI without adding secrets to Firestore events.

## Audit retention and failures

Command summaries and append-only events are retained for at least one UTC calendar year after the latest recorded event. No automatic cleanup or TTL is configured. Started markers are committed before each Auth effect. If the initial intent transaction fails, the command must make no Auth mutation. If a later record write fails, do not claim rollback; check Auth state and retain the target lock for explicit recovery.

The CLI emits one sanitized JSON object to stdout and a short error code to stderr. It never emits full profiles, ID tokens, unrelated custom claims, raw Firebase errors, or credentials. Exit code `0` means the requested read succeeded or a mutation completed/was unchanged with required verification; `6` means a partial or unknown state needs attention. A `status` read itself can exit `0` while describing an unresolved command.
