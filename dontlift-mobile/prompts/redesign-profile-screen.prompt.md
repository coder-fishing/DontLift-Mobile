# P3.5 — Profile Screen Redesign and Avatar Upload

> **Role:** PRIMARY / Senior Mobile UI/UX Designer and React Native Engineer  
> **Skills:** `$ui-ux-pro-max`, `$antislop`, `$react-native-expert`, `$brainstorming`, `$qskill-writing-plans`, `$qskill-executing-plans`, `$qskill-review-plan`  
> **Interaction mode:** plan-then-approve — inspect the current implementation and draft a concrete plan, then wait for explicit approval before changing source files.  
> **Output mode:** end-to-end implementation plan draft → approved Profile redesign, Cloudinary avatar flow, and focused tests.  
> **Antislop mode:** DURING — apply the selected design filter while planning and implementing; do not ask the human to select it again.  
> **Approval gate:** the human has requested this reference for redesign planning. Treat it as approval of the visual direction only. Present the implementation plan and wait for explicit approval before editing source or tests. Show the final diff before any commit. Do not commit or deploy unless explicitly requested.  
> **Canonical output:** `docs/superpowers/plans/YYYY-MM-DD-profile-screen-redesign.md`, followed by the scoped Profile screen implementation and tests.  
> **Run context:** fresh session from the DontLift repository root. Read the checked-in reference image and repository instructions; do not depend on chat attachment access.

---

## 1. When to Use

Use this prompt to redesign the existing DontLift Profile screen using the approved visual reference and implement avatar selection, upload, display, and removal end-to-end. Preserve its current account, profile-edit, Premium, offline, and sign-out behavior. Do not change authentication or entitlement architecture, redesign app-wide navigation, or alter other tabs.

---

## 2. Inputs

Read these inputs before drafting the plan:

- **Repository instructions:** `AGENTS.md`.
- **Approved Profile visual reference:** `design/references/screenshots/15-profile-screen-redesign.png`.
- **Product and visual system:** `docs/product-design.md`, `docs/product-requirements.md` (US-17), `docs/feature-specification.md`, `design/concepts/concept-final/decision-packet.md`, and `src/constants/theme.ts`.
- **Profile and entitlement boundaries:** `docs/software-architecture.md`, `docs/api-contracts.md`, `docs/decisions/ADR-009-auth-profile-bootstrap.md`, `docs/decisions/ADR-010-expo-go-firebase-js.md`, and `docs/decisions/ADR-025-payos-expiring-premium.md`.
- **Current screen and data behavior:** `src/screens/ProfileScreen.tsx`, `src/features/profile/profile-repository.ts`, `src/features/profile/profile-save-state.ts`, and `src/features/premium/premium-entitlement.ts`.
- **Avatar API and backend:** the human-approved endpoint is `/v1/profile/avatar`, using the same base URL as the existing Premium API (`EXPO_PUBLIC_PREMIUM_API_URL`). Locate the Express Premium API repository, current route contract, deployment configuration, and tests before planning. The route path and shared base URL are approved; HTTP methods and request/response schema must be verified from backend source. If the route or contract is missing/incomplete, propose the minimum contract under this same path in the plan and wait for approval before implementing it. Do not create a separate server or domain.
- **Cloudinary configuration:** inspect backend environment-variable conventions. Cloudinary API Secret and signing logic must remain server-side; never request the secret in chat or put it in the mobile app, Expo config, or client environment variables.
- **Screen integration and existing UI:** inspect the caller in `src/app/index.tsx`, `src/components/Header.tsx`, `src/components/BottomNav.tsx`, and `src/components/GlassCard.tsx`. Identify which shell elements are outside `ProfileScreen` and must not be duplicated.
- **Focused tests:** `__tests__/profile-screen.test.tsx`, `__tests__/profile-edit.test.ts`, and `__tests__/registration-profile.test.ts`.
- **Any newer human-approved decision** in the current conversation or repository.

The screenshot contains representative account values. Treat them as examples for layout only; render actual values from profile props and existing entitlement data. The reference establishes the visual direction but does not show the newly approved avatar actions; add those controls coherently without changing the rest of the approved hierarchy.

---

## 3. Task

Use the listed skills to:

1. Inspect current Profile screen structure, app-shell/header/bottom-navigation ownership, profile repository contracts, theme tokens, tests, and git status. Draft a task-by-task implementation plan with exact files, acceptance criteria, risks, and verification commands. **Wait for explicit approval before editing source or tests.**
2. Redesign the Profile screen to match the checked-in reference's hierarchy:
   - Keep the existing DontLift greeting/header and the separate horizontal **“‹ Back to DontLift”** text-link button below it. Do not remove it, replace it with an icon-only control, move it into the header, or add a duplicate back button.
   - Retain “Your profile” and its supporting sentence.
   - Present account identity in a compact surface with a circular avatar image when available, otherwise dynamic initials; show display name, “DontLift account”, and a truthful `PRO` or `FREE` label.
   - Add accessible `Change photo` and `Remove photo` actions. Use an Expo-compatible system image picker and square crop/preview. Keep initials when no photo exists or loading fails. Do not request camera access unless the approved flow includes taking a photo.
   - Show Premium status and its expiry only from the existing authoritative expiry/entitlement state. Provide the existing `Extend Premium` or `Explore Premium` action only when `onPremium` is available. Do not hardcode the reference date or infer active entitlement from a legacy boolean alone.
   - Put display-name editing and read-only email into a separate, high-contrast form surface. Keep the existing helper copy, character count, validation, read-only label, and account-managed explanation.
   - Keep `Save changes` visible and subdued when unchanged; show a clear enabled state when valid changes can be saved. Preserve saving, offline, error, listener, and local-repair feedback.
   - Put `Sign out` after the form as a restrained destructive text action and preserve the existing confirmation and failure handling.
   - Keep the existing bottom navigation in the app shell; do not draw a second copy inside the screen.
3. Use the reference's palette, spacing, surfaces, and visual hierarchy without reproducing layout defects. Preserve the existing DontLift Liquid Acrylic identity with translucency on chrome and readable solid surfaces under form content. Reuse `GlassCard`, semantic colors, spacing tokens, and existing navigation controls where appropriate.
4. Implement the avatar lifecycle using the existing Express service/base URL and `/v1/profile/avatar`. Inspect backend source and its API contract before selecting methods. Intended trust flow:
   - Mobile requests narrowly scoped upload authorization/signature from the authenticated backend.
   - Mobile uploads the selected image directly to Cloudinary.
   - Cloudinary returns the asset URL and identifier to mobile.
   - Mobile submits the result to the same backend route; backend verifies that the asset belongs to the authenticated UID before persisting profile metadata. Never trust an arbitrary client-supplied URL or public ID.
   - Removal clears the profile reference and deletes the Cloudinary asset through a server-authorized operation. Keep the old image until replacement upload and profile update both succeed.
   This normally requires two app-to-backend calls plus one direct upload to Cloudinary. Preserve a different safe contract if one already exists. Do not invent methods or payload fields without backend evidence and plan review.
5. Extend the existing profile model/repository and security allowlist only for the minimum avatar metadata required. Preserve all current field authorities. Propagate avatar URI to the existing app header and group-member presentation through established profile/member data paths; inspect how existing `avatarUri` values are produced before changing room or history contracts.
6. Use a consistent initials fallback that can show up to two letters (the reference shows `HE`). Handle one-word, multi-word, empty, and Unicode names safely.
7. Add or update focused tests for: back-link presence/action/accessibility; actual profile values; Free/active/expired Premium display and optional CTA; initials fallback; picker cancel/permission denial; file validation; upload success/failure/offline/retry; avatar removal; backend authentication/UID scoping/asset verification; profile/header/group propagation; name validation and save states; read-only email; sign-out confirmation/failure; and no duplicate app-shell navigation.
8. After plan approval and implementation, run focused Profile/avatar tests, backend tests, TypeScript, lint, and relevant broader tests when practical. Report exactly what ran. Do not add `react-test-renderer` or other dependencies solely to make a screen test executable; report any environment blocker accurately.

---

## 4. Constraints & Source Precedence

### Source precedence

Resolve conflicts in this order:

1. Newer explicit human-approved decisions.
2. Product requirements and current accepted ADRs for profile ownership, email, and Premium entitlement.
3. `docs/product-design.md`, `src/constants/theme.ts`, and existing shared components for visual identity.
4. The checked-in Profile reference for layout and visual treatment only.
5. Current implementation and tests as evidence of existing behavior.
6. AI inference or proposals.

Report contradictions instead of silently resolving them.

### Strict rules

- Display name remains the only editable text field. Email remains Auth-derived and read-only. Avatar selection/removal is the only newly approved Profile capability; do not add email editing, password changes, account deletion, or unrelated profile storage.
- Use the existing Premium API base URL and exact route path `/v1/profile/avatar`; do not create a second API service or domain. Keep avatar client calls in a Profile/avatar module, separate from `src/features/premium/premium-api.ts` and payment business logic.
- Keep Cloudinary API Secret and signing logic on the Express server. Verify Firebase authentication, UID ownership, upload constraints, and Cloudinary asset identity server-side. Do not accept an arbitrary client URL/public ID as proof of a successful upload.
- Decide and document whether avatar delivery is public to anyone with its URL or restricted to authenticated app/group users. Do not silently change avatar visibility. Specify accepted image formats, maximum file size, replacement/deletion cleanup, and failure behavior in the approved plan.
- Upload a replacement before changing the current profile reference. If upload or profile persistence fails, preserve the old avatar and show a retryable error. Removal returns to initials and must clear stale avatar references from profile/header/group presentation.
- Preserve the existing 1–40 character display-name validation, canonical save behavior, real-time profile updates, protection of unsaved drafts, offline messaging, local repair flow, and sign-out confirmation.
- Premium expiry is server-owned. The client may display the existing profile projection but must not write entitlement fields, alter Premium calculations, or claim that an expired/legacy profile is active. Preserve the existing `onPremium` route.
- Keep **“‹ Back to DontLift”** as a horizontal text link with a left-pointing chevron. Give it an accessible label, visible text, press feedback, and at least a 44 dp hit area.
- Reuse existing components and theme tokens. Do not introduce raw palette values, broad shell/theme refactors, or unrelated screen changes. Add only an Expo-compatible image-picker dependency if no suitable picker already exists, and keep lockfiles synchronized.
- Keep the screen scrollable and usable with the keyboard open, on narrow phones, and above the floating bottom navigation. Ensure text scaling does not cause clipped labels or overlapping controls.
- Do not repeat the email in both the identity summary and the edit form. Keep the reference's sample values dynamic.
- Apply antislop DURING. **Design Read:** profile/account settings for returning DontLift users, using restrained Liquid Acrylic with opaque form surfaces. Dials: **ENERGY 2 / RHYTHM 2 / MOTION 1**. Use one clear focus on profile editing, a compact account summary, a subdued Premium row, a small avatar-change affordance, and one blue interaction accent. Avoid stacked glass cards, duplicate identity, excessive gradient, decorative glow, generic account-management features, and low-contrast disabled text.
- Inspect `git status` before edits and preserve unrelated work. Never reset, revert, or overwrite unrelated user changes.
- Do not output hidden chain-of-thought. Provide concise rationale, decisions, and unresolved questions only.
- Do not commit or deploy unless explicitly requested.

---

## 5. Expected Output

### Before approval

Return a concrete plan in chat, then wait. Save it to the canonical plan path only after the human approves saving. Include:

- current Profile screen and app-shell structure;
- exact files to change and component reuse/extraction choices;
- observable layout and interaction acceptance criteria;
- preservation of profile, email, Premium, offline, save, listener, and sign-out behavior;
- the existing Express backend location and verified `/v1/profile/avatar` contract, or a proposed minimal contract under that same route if it is missing;
- Cloudinary upload signature, UID scoping, asset verification, image visibility, limits, cleanup, and error/retry behavior;
- mobile and backend changes required for profile persistence and avatar propagation;
- focused tests and verification commands;
- baseline failures, risks, and unresolved contradictions.

Do not modify source files or tests before explicit plan approval.

### After approval

Implement only the approved plan. Report changed files, user-visible results, tests and commands actually run, visual/device checks completed, blocked checks, and final diff summary. Do not claim an unrun check passed.

---

## 6. Save or Update

After approval, save/update:

- **Implementation plan:** `docs/superpowers/plans/YYYY-MM-DD-profile-screen-redesign.md` using the actual execution date.
- **Profile screen:** `src/screens/ProfileScreen.tsx` and only the narrowly scoped components/hooks justified by the approved plan.
- **Avatar client/data flow:** a Profile/avatar-specific API client and narrowly scoped profile model/repository/security-rule changes only as required by the approved contract.
- **Existing Express API:** route/module under `/v1/profile/avatar`, tests, and server-side Cloudinary configuration in the existing Premium API service. If the backend repository cannot be found/accessed, stop before claiming end-to-end implementation and report the exact missing path/access.
- **Focused tests:** `__tests__/profile-screen.test.tsx`, `__tests__/profile-edit.test.ts`, `__tests__/registration-profile.test.ts`, and applicable avatar/backend tests.
- **Reference:** `design/references/screenshots/15-profile-screen-redesign.png` is the visual source for this task; do not replace it without explicit human direction.

Update API/product/architecture documents only if the plan identifies a real contract change and the human approves it. This task includes a new avatar storage/upload lifecycle, but must not alter email ownership, authentication, Premium entitlement, or payment contracts.

---

## 7. Human Review Required

Before approving the implementation plan, review:

- whether the separate **“‹ Back to DontLift”** link remains visible and distinct from the app header;
- whether the account summary, Premium status, profile form, and sign-out hierarchy are clear;
- whether photo selection, upload, removal, progress/error states, and initials fallback are clear and accessible;
- whether Cloudinary URL visibility and group-member visibility match the intended privacy choice;
- whether `/v1/profile/avatar` uses the existing Premium API base URL and a backend-verified upload contract;
- whether Cloudinary signing credentials remain server-side and UID ownership is enforced;
- whether read-only email and all existing save/offline/error states remain truthful;
- whether Premium display uses the existing expiry authority and route;
- whether scope avoids email editing, shared shell redesign, entitlement changes, and a new server/domain.

Before accepting implementation, review the diff and test evidence. Any proposed change to profile schema, email ownership, entitlement policy, or navigation contract requires a separate explicit decision.

---

## 8. Validation Checklist

- [ ] Reference image is read from `design/references/screenshots/15-profile-screen-redesign.png`; its hierarchy is followed while approved avatar actions are added coherently.
- [ ] Existing app header, separate Back to DontLift link, title/subtitle, form fields, Premium action, Sign out, and app-shell bottom navigation remain represented without duplication.
- [ ] Avatar photo can be selected, cropped, uploaded, displayed, and removed; dynamic initials remain the safe fallback.
- [ ] Avatar uses the existing `EXPO_PUBLIC_PREMIUM_API_URL` base and `/v1/profile/avatar`; no separate server/domain is introduced.
- [ ] Backend verifies Firebase UID, upload scope, and Cloudinary asset identity; API Secret is never shipped to mobile.
- [ ] Avatar visibility, allowed formats/size, replacement/deletion cleanup, and failure behavior are explicit.
- [ ] Email remains read-only and Auth-derived.
- [ ] Name validation, save, offline, error, listener, and local-repair behavior remain intact.
- [ ] Premium status and expiry are displayed truthfully from current entitlement projection; no entitlement writes are added.
- [ ] Free, active Premium, and expired Premium states have distinct accurate labels and actions.
- [ ] Layout is readable on narrow screens, with safe-area/keyboard clearance, legible contrast, and 44 dp controls.
- [ ] Existing components and semantic theme tokens are reused; new component extraction is justified by repeated use.
- [ ] Focused tests, TypeScript, lint, and any available visual/device checks are run and reported accurately.
- [ ] Any image-picker dependency is Expo-compatible and reflected in both lockfiles; backend changes stay in the existing Express API and include focused tests.
- [ ] No unrelated navigation or entitlement change, commit, or deployment is introduced.

---

## Execution Command

```text
Read `prompts/redesign-profile-screen.prompt.md` and follow it in plan-only mode first. Inspect the checked-in reference, mobile Profile implementation, and existing Express Premium API repository/contract for `/v1/profile/avatar` using the shared Premium API base URL. Draft and present one end-to-end plan for the Profile redesign plus Cloudinary avatar selection/upload/removal, including the authenticated upload lifecycle and image-visibility decision. Save the plan only after I approve it, then wait for explicit approval before changing mobile source, backend source, tests, or deployment configuration.
```
