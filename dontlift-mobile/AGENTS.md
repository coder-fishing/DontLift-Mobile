# AGENTS.md

## Project Purpose

- DontLift is an Android/iOS mobile application for phone-down focus sessions and group accountability.
- Preserve the same product behavior across both platforms unless an approved platform-specific constraint requires a difference.
- Keep changes focused on the requirement. Do not perform unrelated refactors.

## Source of Truth

When documents conflict, use this precedence:

1. Newer explicit human-approved decisions.
2. Accepted ADRs in `docs/decisions/`.
3. `docs/software-architecture.md`.
4. `docs/api-contracts.md` for callable wire contracts.
5. `docs/product-requirements.md` for product scope and acceptance criteria.
6. `docs/product-design.md` and `design/concepts/concept-final/decision-packet.md` for UI.
7. `docs/feature-specification.md`.
8. `docs/project-context.md` and `docs/project-brief.md` as historical context.

Current architectural overrides:

- React Native Firebase owns Firebase token persistence. Do not copy ID or refresh tokens into SQLite, AsyncStorage, or Expo SecureStore.
- Offline-capable events sync through `syncEvents`. Do not write authoritative violation or Solo summary documents directly from the client.
- `rooms/{roomId}/members/{uid}` is the room membership authority; do not use an unbounded `participantIds` array.
- ADR-008 governs Android/iOS background transitions and the 3-Second Grace Period.
- Local Premium and Server Premium are separate entitlements as defined by ADR-007.

## Current Implementation State

- The repository currently contains the Expo UI/prototype layer. The approved Firebase, SQLite, sensor, sync, and native lifecycle architecture is not fully implemented.
- Treat architecture documents as target contracts, not proof that an adapter, native module, or backend already exists.
- Do not fabricate Firebase project IDs, credentials, `.firebaserc`, `firebase.json`, Firestore rules, indexes, or `eas.json`.
- Do not connect the app to an unrelated Firebase project.

## Directory Structure

- `src/app/` — Expo Router route entry points
- `src/screens/` — screen implementations
- `src/components/` — shared UI components
- `src/constants/theme.ts` — semantic design tokens
- `design/concepts/concept-final/` — accepted visual direction and reference prototype
- `docs/` — product requirements, feature specification, architecture, API contracts, and ADRs
- `prompts/ai-coding/` — AI-coding prompt templates

## Development Commands

- Install: `npm install` or `pnpm install`
- Start Metro: `npm start` or `pnpm start`
- Open Android development target: `npm run android` or `pnpm run android`
- Open iOS development target on macOS: `npm run ios` or `pnpm run ios`
- Open web target: `npm run web` or `pnpm run web`
- Lint: `npm run lint` or `pnpm run lint`
- Type-check: `npx tsc --noEmit` or `pnpm exec tsc --noEmit`
- Tests: no test script is currently configured
- Native EAS builds: not configured until the deferred Firebase/EAS provisioning prerequisites are available

Both npm and pnpm are supported. Use one package manager consistently for a command sequence. When dependencies change, keep `package-lock.json` and `pnpm-lock.yaml` synchronized and include both lockfile updates.

## How to Work

- Read related source and documentation sections before editing.
- Reuse existing components, utilities, and patterns. Do not introduce a second convention beside an existing one.
- Do not change dependencies, build configuration, or secrets unless the requirement needs it.
- Do not delete user data, unrelated files, or unrelated code without explicit approval.
- Remove code made obsolete by the requested change after migrating every caller.
- Do not implement features listed as strict exclusions in the approved product documents.

## Code Conventions

- Follow the existing TypeScript and React Native conventions.
- Prefer type-safe TypeScript. Do not introduce `any` without a documented boundary that cannot be typed safely.
- Extract shared UI only when multiple consumers or a clear component boundary justify it.
- Keep user-facing content consistent in language and tone.
- Use semantic tokens from `src/constants/theme.ts`; do not add raw color values to components.
- Keep sensor polling, persistence, synchronization, scoring, and bill allocation outside screen components.

## Skills

- Use `brainstorming` before adding features or changing behavior.
- Use `react-native-expert` for React Native, Expo, navigation, native modules, and mobile performance work.
- When an applicable Firebase, debugging, UI-audit, or review skill is available in the active harness, use it before editing that area.
- Do not invent or claim use of an unavailable skill.

## Documents by Change Type

Always read the relevant source files and the Source of Truth section above.

For product behavior:

- `docs/product-requirements.md`
- The relevant section of `docs/feature-specification.md`
- Any applicable ADR

For backend, persistence, authentication, synchronization, entitlement, or lifecycle:

- `docs/software-architecture.md`
- `docs/api-contracts.md`
- Applicable files in `docs/decisions/`

For UI or accessibility:

- `docs/product-design.md`
- `design/concepts/concept-final/decision-packet.md`
- `src/constants/theme.ts`

Do not treat `docs/project-brief.md` as current implementation architecture.

## Git Conventions

- Branch: `feature/<slug>`, `fix/<slug>`, or `docs/<slug>`
- Commit: `type(scope): description` where type is `feat`, `fix`, `docs`, `refactor`, `test`, or `chore`
- When working from a named plan, use its slug as the commit prefix, for example `[2026-09-23-mvp-s0-foundation]`
- Never commit secrets, `.env.local`, or native Firebase credentials

## Verification

- Run the checks relevant to the changed area. Do not claim checks that were not run.
- For TypeScript changes, run `pnpm exec tsc --noEmit`.
- For lint-covered changes, run `pnpm run lint`.
- For UI changes, run the affected screen and inspect its actual rendered states, narrow-screen behavior, touch targets, and accessibility behavior.
- For sensor or lifecycle changes, verify on physical Android/iOS devices; emulator-only evidence is insufficient for sensor accuracy.
- For offline changes, exercise local commit, restart, reconnect, retry, and duplicate delivery.
- For bill allocation changes, verify integer arithmetic, non-negative shares, and `sum(shares) === totalBillVnd`.
- For Firebase changes, use Emulator Suite validation before deployment.
- If a required check cannot run, state the exact blocker and remaining unverified behavior.

## Reporting Results

- Summarize user-visible behavior.
- List the main files edited and checks run.
- State remaining risks or unverified platform behavior.