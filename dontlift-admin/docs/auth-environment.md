# Authentication Environment

DontLift Admin uses the same Firebase Auth and Firestore Cloud project as DontLift Mobile during normal development. The normal `pnpm dev` workflow is cloud mode; it does not start or connect to Firebase emulators.

## Cloud configuration

Copy the public Web SDK settings from the mobile project's ignored `.env.local` into the admin project's ignored `.env.local`:

| Admin variable | Mobile variable |
|---|---|
| `NEXT_PUBLIC_FIREBASE_API_KEY` | `EXPO_PUBLIC_FIREBASE_API_KEY` |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | `EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN` |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | `EXPO_PUBLIC_FIREBASE_PROJECT_ID` |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | `EXPO_PUBLIC_FIREBASE_APP_ID` |
| `FIREBASE_PROJECT_ID` | `EXPO_PUBLIC_FIREBASE_PROJECT_ID` |
| `ADMIN_OPERATOR_PROJECT_ID` | `EXPO_PUBLIC_FIREBASE_PROJECT_ID` |

Set both runtime mode variables to `cloud` and set `ADMIN_OPERATOR_MODE=cloud`. The server and browser project IDs must match. The public Firebase Web configuration is not a privileged credential.

Server-side Firebase Admin access uses Application Default Credentials (ADC). Use the approved operator/developer identity with the required Firebase Auth permissions. No service-account JSON, private key, or other privileged credential is supported in browser code, `.env.example`, URLs, or repository files. Admin SDK authorization uses IAM and bypasses Firestore client Rules; verify both boundaries independently.

The local `.env.local` is ignored by Git and must be prepared separately on each workstation.

## Optional isolated tests

The demo Firebase Emulator Suite is optional and is never the normal app default. Its test helpers set `FIREBASE_RUNTIME_MODE=demo`, project `demo-dontlift-admin`, and loopback Auth/Firestore endpoints only in their own test process. This prevents cloud values in `.env.local` from being reused by emulator fixtures.

To run these optional checks, start the emulators with `pnpm dev:emulator`, then use `pnpm test:seed`, `pnpm test:integration`, or `pnpm test:e2e`. The Emulator Suite requires Firebase CLI and its supported Java runtime; Next.js cloud development and unit tests do not.

## Remaining cloud verification

1. Verify the email/password provider is enabled in the shared Firebase Auth project; mobile source shows its sign-in method but does not prove live provider configuration.
2. Confirm ADC is bound to an authorized identity with the minimum required Auth permissions.
3. Use owner-approved non-production identities for connected acceptance testing. Do not create/modify real Firebase accounts during setup.
4. Verify Firestore Rules and IAM independently. Do not assume Admin SDK calls inherit client Rules.

Configuration validation fails closed when browser/server modes or project identifiers disagree. This setup does not authorize production deployment or account mutations.
