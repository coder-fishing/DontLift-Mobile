export const DEMO_FIREBASE_PROJECT_ID = "demo-dontlift-admin";

/** Configure only an isolated Firebase Emulator Suite runtime for optional tests. */
export function configureDemoFirebaseEnvironment(environment: NodeJS.ProcessEnv = process.env): void {
  Object.assign(environment, {
    FIREBASE_RUNTIME_MODE: "demo",
    NEXT_PUBLIC_FIREBASE_RUNTIME_MODE: "demo",
    FIREBASE_PROJECT_ID: DEMO_FIREBASE_PROJECT_ID,
    NEXT_PUBLIC_FIREBASE_PROJECT_ID: DEMO_FIREBASE_PROJECT_ID,
    NEXT_PUBLIC_FIREBASE_API_KEY: "demo-api-key",
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: "127.0.0.1",
    NEXT_PUBLIC_FIREBASE_APP_ID: "demo-app-id",
    FIREBASE_AUTH_EMULATOR_HOST: "127.0.0.1:9099",
    FIRESTORE_EMULATOR_HOST: "127.0.0.1:8080",
    NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_URL: "http://127.0.0.1:9099",
    ADMIN_OPERATOR_MODE: "emulator",
    ADMIN_OPERATOR_PROJECT_ID: DEMO_FIREBASE_PROJECT_ID,
    ADMIN_OPERATOR_ID: "local-test",
  });
}
