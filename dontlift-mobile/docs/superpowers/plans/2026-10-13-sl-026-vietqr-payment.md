# SL-026 — VietQR payment for the current user's share

**Plan slug:** `2026-10-13-sl-026-vietqr-payment`.
**Branch:** `feature/sl-026-vietqr-payment`; real checkout, no worktree.
**Status:** implemented 2026-10-22; automated checks passed; Expo Go and banking-app acceptance pending.
**Approval evidence:** Human selected VietQR's existing image API using the stored bank BIN, account, name and published share, then requested implementation with UI skills. Preserve Firebase Spark and Expo Go. On 2026-10-22 the human subsequently requested grouped commits, push and a PR. Billing and backend deployment remain outside scope.
**Sources:** API §6.5, product design §6.3, feature spec §4.3, ADR-020/021/022, AGENTS.md.
**Dependencies:** SL-023 authorized bank details, SL-024 default bill, SL-025 current version pointer.

## Design and authority

Use VietQR Quick Link with `qr_only.svg`; the provider's October 2026 notice prefers SVG and plans to retire PNG/JPEG. Build a URL on-device; image rendering is the only provider request. No secret/key or payment API is involved. Render the SVG with the already installed expo-image package.

Read the current authenticated member's share from the published bill stream; never use an entered amount, default mock, stale receipt, or saved breakdown to generate a QR. Follow the SL-025 active version. Listen to membership-authorized Host bank details; cached or locally pending data is not current. Replacing a publication or recipient unmounts the old QR image.

Require the selected six-digit bank BIN, account containing 1–19 letters/digits, nonempty Host-provided account name, positive integer share of at most 13 digits, current room identity, and unexpired details. Zero share shows no transfer required. Preserve account leading zeros. The memo is `DL {8-digit room PIN} {normalized member name}`, uppercased ASCII without special characters, at most 50 characters. Shorten the name only and show the actual memo sent to VietQR. Details remain memory-only. Account holder text is not a verified bank lookup.

## UI direction and skills

Apply qskill-executing-plans inline; ui-ux-pro-max, react-native-expert, and core antislop during implementation, using the previously approved Liquid Acrylic direction. Existing antislop pointer/mode remain applicable; optional modules are unavailable and are not downloaded.

Show a single prominent amount above a white, uncropped square QR with reserved space. Use the existing semantic palette, glass surfaces, restrained typography and 48dp controls. A separate transfer-details card holds selectable account/memo values for native copying. Keep the parent scroll view and safe-area/bottom-nav clearance. Do not add payment-success controls. Back returns to breakdown.

Loading/provider timeout/error have visible feedback and explicit retry. Unavailable/cache/offline/expired inputs hide the QR. Screen refresh reconnects bill and details listeners. A new image identity includes the request, revision, recipient and amount. QR image requests bypass cache. Actual bank-app/Expo Go rendering is not established by Jest tests.

## Tasks

- [x] Inspect real checkout, prerequisite data models, navigation, UI references and current provider documentation.
- [x] Add the pure URL/memo/state adapter in `src/features/settlement/vietqr-payload.ts`.
- [x] Add realtime payment-details reads to the existing repository using the existing Rules.
- [x] Add Pay your share navigation from BillAllocationScreen, current-version inputs, refresh/back, and connectivity on the QR screen.
- [x] Replace the placeholder VietQR screen with the payment/transfer-details layout and image loading/error/retry states.
- [x] Update API, design and feature spec to the provider SVG contract; no new Firebase authorization exception.
- [x] Run focused payload, screen, subscription and navigation checks; TypeScript and whitespace checks.
- [ ] Inspect on Expo Go Android/iOS: narrow screen, font scale, dark/light, foreground/reconnect, image failure and recipient/bill changes.
- [ ] Validate amount, recipient and memo by scanning with five actual banking apps. Do not transfer real funds to test.

## E3 and acceptance

Provider/format is resolved by the approved Quick Link approach and current official documentation. Proposed device cohort for later verification: Vietcombank, BIDV, MB, Techcombank and ACB. These are proposed test targets, not a claim of compatibility or a human-approved completed cohort. Missing device evidence blocks full acceptance, not the authorized implementation.

Required outcomes: exact integer amount, safe normalized memo, no QR for missing/unauthorized/cross-room/cache/expired inputs, native copy selection, zero-share handling, replacement of a previous QR when the bill/account changes, image retry, and no false paid status. Firestore authorization remains SL-023/024/025's existing Rules; this slice changes no Rules and deploys nothing.

## Evidence

- UI skill local query `payment loading feedback --stack react-native`: verified relevant results for native press feedback and loading indicators. Theme follows the existing concept rather than adding a new design system.
- Provider docs checked 2026-10-22: https://www.vietqr.io/qr-dong and https://www.vietqr.io/thong-bao-cap-nhat.
- A live GET using the provider's public demonstration bank/account returned HTTP 200, `image/svg+xml`, 19,989 bytes with SVG markup. No user account details were used in this request. This proves image delivery only, not banking-app scan compatibility.
- Focused Jest suites: `vietqr-payment`, `vietqr-screen`, `payment-details-listener`, `group-connectivity`, `bill-allocation-screen`, `published-bill-listener`, `published-bill-navigation`. All 45 cases pass. Tests mock Firebase/native rendering; they do not prove actual bank scanning or live Firebase authorization.
- `pnpm exec tsc --noEmit`: PASS. `git diff --check`: PASS. Lint not run: no committed ESLint configuration is present. No Firestore Rules or dependency/lockfiles changed; no deployment performed.
- Expo Go layout (Android/iOS, font scaling, dark/light, narrow width) and scans on five actual banking apps: UNVERIFIED. No physical device session is attached. This implementation must not be reported as fully accepted until that evidence exists.
- Git delivery approved 2026-10-22: split publication recovery, QR/data adapters, UI/navigation and documentation into separate commits; push this branch and open a PR to main.
- Expo feedback uncovered an SL-024 publication bug: its final transaction read a receipt before `publishedBillReadable` permitted access. A regression fixture reproduces `permission-denied`; the transaction now reads a receipt only for an already-published replay. First publication creates the immutable receipt without a forbidden pre-read. All six `bill-repository` tests, TypeScript and whitespace checks pass after this fix. Rules are unchanged; native/cloud retry remains to be confirmed by the user.
- Final pre-PR run: all eight relevant Jest suites passed together, 51/51 tests. TypeScript and whitespace checks passed again. Physical Expo Go and banking-app scan evidence remains pending.
