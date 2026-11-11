# Profile Screen Redesign and Avatar Upload Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use the qskill-executing-plans skill to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
> This plan is intentionally skeleton-level: it specifies files, behavior, and test cases, not implementation code. Re-read the real files before each task.

**Goal:** Redesign the Profile screen to match the approved reference and add Cloudinary avatar selection, upload, display, removal, and group-member propagation without changing existing account or Premium authority.

**Architecture:** Use the system photo library picker and the existing Premium Express API base URL. The authenticated API owns Cloudinary upload and deletion and persists avatar metadata to the authenticated Firestore profile; the mobile app observes the canonical profile through its existing listener and stores an offline projection in SQLite. Existing room-member avatar fields and presentation paths carry the avatar to Group surfaces.

**Tech Stack:** Expo SDK 58, React Native 0.88, TypeScript, Firebase Auth/Firestore, SQLite, Express, Cloudinary, `expo-image-picker`, `expo-image`.

**Spec:** `prompts/redesign-profile-screen.prompt.md`; approved reference: `design/references/screenshots/15-profile-screen-redesign.png`; product rules: `docs/product-requirements.md` (US-17), `docs/product-design.md`, `docs/software-architecture.md`, `docs/api-contracts.md`, and `src/constants/theme.ts`.

**Plan slug:** `2026-11-08-profile-screen-redesign` — every commit for this plan starts with `[2026-11-08-profile-screen-redesign]`.

## Global Constraints

- Keep the same behavior on iOS and Android.
- Preserve the horizontal “‹ Back to DontLift” link, app-shell Header and BottomNav, and all existing Profile, Premium, offline, save, listener, local-repair, and sign-out behavior.
- Display name remains the only editable text field; email remains Auth-derived and read-only; Premium expiry remains server-owned.
- Use the existing Premium API origin and `/v1/profile/avatar`; do not introduce another server or domain.
- Cloudinary API Secret and signing logic stay on the Express server.
- The user approved public Cloudinary avatar URLs. Do not imply URLs are restricted to room members.
- Reuse existing components and semantic theme tokens. Extract shared avatar UI only where Profile, Header, and Group presentation genuinely share it.
- Keep existing user changes. Do not commit or deploy.
- The backend repository is at `D:\premium-api`, outside the current writable roots. Before editing it, obtain the required writable access; do not claim end-to-end completion if backend access is unavailable.

---

## Current State and Verified Contracts

- `src/screens/ProfileScreen.tsx` has the existing back link and profile behaviors, but renders a single large `GlassCard`; its avatar is currently one initial.
- `src/app/index.tsx` owns the app Header and BottomNav. It passes display name/email to `Header`, but not an avatar URI.
- `src/components/Header.tsx`, `src/components/GroupHomeDashboard.tsx`, `src/features/rooms/room-listener.ts`, and `src/features/history/group-history-repository.ts` already recognize optional avatar URIs. Room creation/join currently do not populate them.
- Profile data is parsed in `src/features/auth/firebase-profile.ts`, cached in `src/features/auth/local-profile-repository.ts`, and its SQLite table is migrated in `src/features/local/migrations.ts` (current migration 14).
- Firestore profile update rules currently permit display-name changes only. Room member updates are narrowly allowlisted.
- The deployed API source documents authenticated `POST /v1/profile/avatar` with raw JPEG/PNG/WebP bytes, a 5 MB maximum, and `{version, url, publicId}` response. It uploads to Cloudinary with a stable per-UID public ID, does not write Firestore, and has no removal operation. Backend tests currently have no dedicated avatar cases.
- Render showed the avatar API deployment succeeded. Runtime Cloudinary configuration and a real upload have not been verified; do not inspect or expose secrets.

## Files and Responsibilities

- Mobile Profile UI: `src/screens/ProfileScreen.tsx` — layout, picker/removal actions, progress/error feedback, existing name and sign-out behavior.
- Shared avatar presentation: create `src/components/Avatar.tsx` only if the common rendering/fallback/error behavior is reused; otherwise keep the change local to current components.
- Mobile API: create `src/features/profile/avatar-api.ts` — authenticated raw-image upload and removal calls using the existing API origin.
- Profile model/parser: `src/features/auth/auth-controller.ts`, `src/features/auth/firebase-profile.ts` — optional avatar URL and Cloudinary public ID.
- Local cache: `src/features/auth/local-profile-repository.ts`, `src/features/local/migrations.ts` — persist and restore avatar metadata without invalidating old rows.
- App-shell integration: `src/app/index.tsx`, `src/components/Header.tsx` — pass the canonical avatar URI and retain initials fallback.
- Member propagation: `src/features/rooms/room-repository.ts`, `src/features/rooms/room-listener.ts`, `src/features/history/group-history-repository.ts`, `src/features/history/group-history-cache.ts`, `src/components/GroupHomeDashboard.tsx`, and `firestore.rules` — create and update only the current user's member avatar projection.
- Express avatar lifecycle: `D:\premium-api\src\routes\profile.js`, `src\controllers\avatarController.js`, `src\services\avatarService.js`, `src\server.js`, `src\app.js`, and a focused avatar profile repository if needed. Keep Firebase Admin and Cloudinary operations server-side.
- Tests: mobile profile/model/local-cache/rules/room tests and backend HTTP/avatar service tests.
- Dependency manifests: `package.json`, `pnpm-lock.yaml`, and `package-lock.json` if the Expo picker is not already a direct dependency.

## Task 1: Make the Avatar API lifecycle safe and canonical

**Files:**
- Modify: `D:\premium-api\src\routes\profile.js`
- Modify: `D:\premium-api\src\controllers\avatarController.js`
- Modify: `D:\premium-api\src\services\avatarService.js`
- Modify: `D:\premium-api\src\server.js`
- Create if needed: `D:\premium-api\src\repositories\avatarProfileRepository.js`
- Create: `D:\premium-api\test\avatar.test.js`
- Modify: `D:\premium-api\test\http.test.js`, `D:\premium-api\README.md`

- [x] Add failing backend tests for missing/invalid auth, supported and unsupported MIME types, empty/oversized/mismatched image bytes, Cloudinary failure, profile persistence failure, successful replacement, removal, and UID scoping.
- [x] Confirm API returns a clear unavailable error when the Cloudinary environment trio is absent; never log credential values.
- [x] Change uploads to use a new UID-scoped asset ID per replacement so the current avatar remains available until the new profile write succeeds.
- [x] For upload, derive UID from verified Firebase token; validate bytes and format; upload the new asset; persist its URL and public ID in that UID's Firestore profile; then queue cleanup of the previous asset. If profile persistence fails, keep the previous profile and queue cleanup of the unreferenced new asset.
- [x] Add authenticated `DELETE /v1/profile/avatar` with no client-supplied UID or public ID. Define `POST` success as `{version: 1, url, publicId, cleanupPending}` and `DELETE` success as `{version: 1, removed: true, cleanupPending}`; API errors retain the existing `{version: 1, code}` shape.
- [x] Atomically update canonical profile metadata and record Cloudinary public IDs awaiting deletion in a server-only cleanup queue, including rollback assets after a failed profile write. The app hides an avatar as soon as its profile reference is cleared; the API retries queued deletions on later avatar operations and clears queue entries only after Cloudinary confirms deletion. Return `cleanupPending: true` when profile state is safely updated but remote deletion still needs retry; never claim the old public asset is already deleted in that case.
- [x] Drain any prior cleanup entries before/after upload and removal. Keep queue ownership scoped to the authenticated UID and validate every Cloudinary public ID against that UID's avatar namespace.
- [x] Update the API's web CORS method allowlist to include `DELETE` if the route is available to web clients. Keep all operations within the existing API origin and route path.
- [x] Run backend tests from `D:\premium-api` with `pnpm test` after writable access is available.

## Task 2: Extend profile model and local projection

**Files:**
- Modify: `src/features/auth/auth-controller.ts`
- Modify: `src/features/auth/firebase-profile.ts`
- Modify: `src/features/auth/local-profile-repository.ts`
- Modify: `src/features/local/migrations.ts`
- Modify: `__tests__/profile-edit.test.ts`, `__tests__/registration-profile.test.ts`, `__tests__/local-database.test.ts`

- [x] Add optional `avatarUri` and `avatarPublicId` profile metadata; accept profiles without either field so existing accounts remain valid.
- [x] Add a new migration after version 14 for nullable avatar columns in `local_profiles`; old profile rows receive null values and retain all existing data.
- [x] Update local profile upsert and restore reads to preserve the new fields.
- [x] Add tests for parsing missing/valid avatar metadata, updating local projection, reopening legacy database rows, and not confusing avatar fields with Premium or email authority.

## Task 3: Add the picker/API client and redesign Profile

**Files:**
- Modify: `src/screens/ProfileScreen.tsx`
- Create: `src/features/profile/avatar-api.ts`
- Create if justified by shared use: `src/components/Avatar.tsx`
- Modify: `src/components/Header.tsx`, `src/app/index.tsx`
- Modify if needed: `package.json`, `pnpm-lock.yaml`, `package-lock.json`
- Modify: `__tests__/profile-screen.test.tsx`

- [x] Add Expo SDK 58 compatible `expo-image-picker` only if not already directly installed. Use library selection with square crop; do not request camera permission.
- [x] Add an authenticated Profile avatar client that sends the selected image bytes as the API's raw body with its real MIME type and Firebase Bearer token, and validates response version, URL, and public ID.
- [x] Keep the existing “‹ Back to DontLift” as a visible horizontal chevron-and-text link with accessible label, press feedback, and at least 44 dp hit area.
- [x] Recompose the screen around the approved reference: compact identity/avatar surface, truthful Premium status/action, separate readable name/email form, subdued disabled Save state, and destructive Sign out after the form. Do not repeat email or duplicate shell navigation.
- [x] Add `Change photo` and `Remove photo`; represent picker cancellation without error; show upload/removal progress; keep the current photo until replacement is canonical; give failures a clear retry path.
- [x] Use dynamic initials for no photo or image load failure, including empty, one-word, multi-word, and Unicode names. Use `expo-image` for image rendering.
- [x] Feed the avatar from canonical profile state into the app Header. Preserve Header initials when missing or if image loading fails.
- [x] Keep existing 1–40 character name validation, read-only email, Premium expiry projection, offline messages, save/local repair behavior, realtime listener, and sign-out confirmation unchanged.
- [x] Test picker cancel, upload success/failure, removal, stale image prevention, initials fallback, existing save flow, Premium states, and no duplicated bottom navigation.

## Task 4: Propagate profile avatars to group members

**Files:**
- Modify: `src/features/rooms/room-repository.ts`
- Modify: `src/features/rooms/room-listener.ts`
- Modify: `src/features/history/group-history-repository.ts`
- Modify: `src/features/history/group-history-cache.ts`
- Modify: `src/components/GroupHomeDashboard.tsx`
- Modify: `firestore.rules`
- Modify focused room/history/rules tests, including `functions/tests/profile-owner-read.rules.emulator.test.cjs`, `functions/tests/room-create.rules.emulator.test.cjs`, and `functions/tests/room-join-pin.rules.emulator.test.cjs`; add a dedicated rule case if clearer.

- [x] Include the canonical avatar URI when creating or joining a room member projection; omit it for users without a photo.
- [x] Add a narrow rule path for a signed-in member to update only their own avatar projection, and only when the submitted value matches the canonical value in their user profile. Keep score, room role, membership state, and payment fields protected.
- [x] After canonical profile avatar changes, discover the user's room memberships via the existing owner-scoped `users/{uid}/groupRooms` index and update only that user's member projection. On removal, clear the member URI when the canonical profile has no avatar. Apply bounded writes and preserve a retryable state if some rooms cannot update.
- [x] Keep group-history cache and member renderers tolerant of missing/stale avatar values; initials remain the fallback.
- [ ] Test profile avatar propagation into current room member data and history, owner-only updates, rejection of mismatched URLs, and legacy documents without avatar fields.

## Task 5: Verify app and backend behavior

**Files:** all files changed above.

- [x] Run focused mobile tests: direct Jest equivalent of `pnpm test -- --runInBand __tests__/profile-screen.test.tsx __tests__/profile-edit.test.ts __tests__/registration-profile.test.ts __tests__/local-database.test.ts` plus avatar API tests (40 passed).
- [ ] Run Firestore Rules emulator tests for profile and membership avatar updates.
- [x] Run backend tests with `pnpm test` in `D:\premium-api` after writable access is available (20 passed, 1 skipped; Firestore integration skipped without emulator).
- [ ] Run `pnpm exec tsc --noEmit` and `pnpm run lint` in the mobile repository.
- [ ] Inspect the actual screen on available Android and iOS devices: picker cancel, crop, upload, replacement, removal, offline/error retry, long names, image-load failure, keyboard, safe areas, and group roster refresh.
- [ ] Report which platforms/devices were actually checked and identify every unavailable check; do not claim an unrun check passed.

> **Validation note (2026-11-09):** Focused avatar/profile/migration tests pass (41 tests) and backend tests pass (20 passed, one Firestore integration skipped). The Rules emulator could not launch because Java is missing. Full mobile TypeScript and lint commands expose existing repository errors outside this change; the full Jest run also hits stale Group History/Group Home theme mocks. Android/iOS visual checks were not available in this environment.

## Human Review and Known Risks

- **Approved visibility:** Cloudinary URLs are publicly retrievable by anyone who has the exact URL. The human approved this behavior for profile avatars.
- **Deletion consistency:** Firestore and Cloudinary cannot participate in one transaction. The backend must define compensating cleanup/retry behavior and avoid returning success while the old public asset is known to remain after a requested removal.
- **Room propagation:** Existing `avatarUri` fields are optional but currently not produced by room create/join. Rule changes must remain limited to the signed-in member changing their own avatar projection to the canonical profile value.
- **Backend access:** `D:\premium-api` is outside the current writable roots and its Git worktree status was not verified. Obtain writable access before editing it; do not silently omit backend changes and call the feature end-to-end.
- **Runtime configuration:** Render reported deployment success, but Cloudinary environment configuration and a live upload have not been verified. Check presence/configuration without printing secret values before device smoke testing.
- **Design tooling:** The local `ui-ux-pro-max` searchable dataset could not run because Python is unavailable. The plan follows the checked-in reference, existing theme, and the skill's loaded accessibility/mobile guidance.

## Validation Checklist

- [x] Back link and app-shell navigation remain present exactly once.
- [x] Profile data remains dynamic; email is read-only; Premium status stays server-derived.
- [x] Picker cancellation is harmless; selected image crops square; upload progress, errors, retry, replacement, and removal have explicit states.
- [x] Cloudinary API Secret remains server-only; API derives ownership from Firebase token.
- [x] Profile metadata and local cache remain backward compatible.
- [x] Group member avatar writes are self-scoped and equal the canonical profile value.
- [x] No stale avatar is displayed as confirmed after replacement/removal failure.
- [ ] Touch targets, screen-reader labels, long text, keyboard, and safe-area behavior are checked on devices.
- [ ] Focused mobile, Rules, backend, TypeScript, lint, and device checks are reported accurately.
- [x] No unrelated tab, authentication, entitlement, payment, commit, or deployment change is included.

## Execution Command

```text
Read `docs/superpowers/plans/2026-11-08-profile-screen-redesign.md` and `prompts/redesign-profile-screen.prompt.md`. Use qskill-executing-plans and implement task by task only after explicit human approval. Before backend changes, obtain writable access to `D:\premium-api`; do not change Cloudinary secrets or deploy. Preserve all unrelated work, run the listed focused verification, and report actual device/platform results.
```
