# SL-027 — Host manual payment confirmation

Status: APPROVED for implementation, human approval 2026-10-22.
Plan slug: 2026-10-13-sl-027-manual-payment-status.
Branch: feature/sl-027-manual-payment-status. Dependency: SL-026 and ADR-022.

## Approved scope

ADR-023 supersedes the original callable draft. Keep Expo Go and Firebase Spark, without Functions, billing or bank polling. Only Host confirms payment, one way. Zero shares require no payment. The first confirmed payment locks bill overrides.

Command binds version, request ID, room, member, current publication and expected revision. One Rules-checked transaction changes current share payment fields, increments room paid counter and creates an immutable receipt. Server timestamps only. Exact replay returns the prior result; changed payload, obsolete publication, partial writes and duplicate increment are rejected. Readback failure after commit keeps a successful pending timestamp.

## Implementation

- [x] Repository and domain parser: payment-status-repository.ts and payment-status-domain.ts.
- [x] Rules: current default/override share, atomic receipt/counter and immutable paid state.
- [x] Live bill metadata and stale-result protection.
- [x] Host confirmation modal, per-share status, independent pending-request retry.
- [x] Member read-only status; replace paid QR with Host-confirmed status.
- [x] ADR-023, API and architecture documentation.
- [x] Focused Jest tests and local Firestore Emulator payment suite.
- [ ] Physical Expo Go Host/Member acceptance, including offline retry and version/payment race.

## Verification

Run TypeScript and affected Jest suites. Run Firestore Rules tests against demo-dontlift-expo-go only; Java is available in Android Studio jbr. Test files share one emulator database and must run serially to avoid clearFirestore races. No Cloud deployment is part of implementation.

Manual acceptance: Host cancels confirmation without writes; confirms positive share; Member sees paid and QR disappears; first paid locks adjustment; zero share has no action; retry after lost response increments once; concurrent revision switch rejects obsolete payment. Confirm on Android/iOS with two accounts.

## Exclusions

Automatic bank verification, paid reversal, bank polling, paid services, new self-confirmation, and offline queued commands.

## Evidence — 2026-10-22

- TypeScript: passed. Focused Jest: 50 tests across 6 suites passed.
- SL-027 Firestore Emulator suite: 13 checks passed (default/override paths, partial writes, unauthorized actors, replay/new request, stale revision, zero share, expiry, immutable paid fields and superseded default path).
- Full room Rules regression: 44 passed, 7 failed. Remaining failures include the 25-member staging budget, invalid-roster preparation and existing tests assuming withSecurityRulesDisabled returns callback data; full regression is NOT green. Do not infer production deployment readiness from the focused suite.
- Lint: 37 errors and 20 warnings with Expo's generated default config, including existing set-state-in-effect violations. Removed the generated config; no unrelated lint migration performed.
- No Firebase Cloud deploy, billing, commit or push. Actual rendered Expo Go/device review remains pending.
