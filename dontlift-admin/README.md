# DontLift Admin

DontLift Admin is a private Next.js App Router application for trusted admin sign-in and read-only operations: an overview, Firebase user inspection, Premium order records, and payment revenue reports. It reads the same Firebase project as DontLift Mobile through protected server routes. It does not disable accounts, grant Premium, change payment state, or edit package prices.

## Local development

Requirements: Node.js 24 and pnpm 11. **The app does not require Firebase emulators or Java to run.**

```powershell
pnpm install
```

Set `.env.local` from the public Firebase Web settings in `dontlift-mobile/.env.local`:

| Admin setting | Copy from mobile |
|---|---|
| `NEXT_PUBLIC_FIREBASE_API_KEY` | `EXPO_PUBLIC_FIREBASE_API_KEY` |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | `EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN` |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | `EXPO_PUBLIC_FIREBASE_PROJECT_ID` |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | `EXPO_PUBLIC_FIREBASE_APP_ID` |
| `FIREBASE_PROJECT_ID` | Same project ID as `NEXT_PUBLIC_FIREBASE_PROJECT_ID` |
| `ADMIN_OPERATOR_PROJECT_ID` | Same project ID as mobile |

Copy `.env.example` to `.env.local` and fill the values from the mobile app's public Firebase Web configuration. These are Firebase Web app settings, not privileged credentials.

The server-side Firebase Admin SDK uses Application Default Credentials (ADC). Configure ADC through your approved Google Cloud identity with the needed Firebase Auth permissions before expecting server identity checks to succeed. Do not put service-account keys in the browser or repository.

```powershell
pnpm dev
```

Open `http://localhost:3000/login`. Next.js connects Auth from the configured shared cloud project; every admin data route verifies access on the server before reading Firebase Auth or Firestore. See [admin data queries](docs/admin-data-queries.md) for report rules, query limits, and index requirements.

## Checks

```powershell
pnpm typecheck
pnpm lint
pnpm test:unit
pnpm build
```

Unit tests use isolated fakes and forcibly disable Firebase cloud/emulator runtime initialization. They do not read or write the shared Firestore project.

## Optional emulator tests

The Emulator Suite is only for isolated integration and browser tests; it is not part of `pnpm dev`. These optional checks require Firebase CLI and a supported Java runtime:

```powershell
pnpm dev:emulator
```

In a separate terminal:

```powershell
pnpm test:seed
pnpm test:integration
pnpm test:e2e
```

The test helpers force the dedicated `demo-dontlift-admin` project and loopback Auth/Firestore endpoints in their own processes, regardless of the cloud values in `.env.local`. The seeder creates only local emulator identities. Emulator tests load the existing mobile Firestore Rules without modifying them; no cloud accounts are used.

## Trusted admin access CLI

The CLI uses the exact shared cloud project configured in `.env.local` and ADC from the trusted operator environment. `--operator` is audit metadata, not authorization.

```powershell
pnpm admin:access -- inspect --project <project-id> --uid <exact-uid>
pnpm admin:access -- status --project <project-id> --command-id <uuid>
pnpm admin:access -- grant --project <project-id> --uid <exact-uid> --operator <operator-reference> --reason <reason> --command-id <uuid> --apply
pnpm admin:access -- revoke --project <project-id> --uid <exact-uid> --operator <operator-reference> --reason <reason> --command-id <uuid> --apply
```

Revoke invalidates refresh tokens account-wide and can sign the same user out of mobile or other clients. Partial/unknown commands retain their target locks; inspect status and follow the explicit recovery procedure before `reconcile`. See [admin access operations](docs/admin-access-operations.md), [environment setup](docs/auth-environment.md), and the [operator contract](specs/001-admin-auth-access/contracts/operator-cli.md).
