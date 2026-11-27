import { randomBytes } from "node:crypto";
import { pathToFileURL } from "node:url";
import { getAuth } from "firebase-admin/auth";
import { configureDemoFirebaseEnvironment } from "./lib/demo-environment";
import { initializeOperatorFirebase } from "./lib/operator-firebase";
import { parseFirebaseRuntimeConfig } from "../src/lib/firebase/config";

export function assertDemoSeedEnvironment(environment: Record<string, string | undefined>) {
  const config = parseFirebaseRuntimeConfig(environment);
  if (
    config.mode !== "demo" ||
    environment.ADMIN_OPERATOR_MODE !== "emulator" ||
    environment.ADMIN_OPERATOR_PROJECT_ID !== config.projectId ||
    config.projectId !== "demo-dontlift-admin"
  ) {
    throw new Error("Demo fixtures may only be seeded into demo-dontlift-admin emulators.");
  }
  return config;
}

function newEphemeralPassword(): string {
  return `${randomBytes(18).toString("base64url")}aA1!`;
}

async function ensureUser(
  auth: ReturnType<typeof getAuth>,
  input: { uid: string; email: string; password: string; disabled?: boolean },
): Promise<void> {
  try {
    await auth.createUser(input);
  } catch (error) {
    if (
      !error ||
      typeof error !== "object" ||
      !("code" in error) ||
      error.code !== "auth/uid-already-exists"
    ) {
      throw new Error(`Could not create demo fixture ${input.uid}.`);
    }
    await auth.updateUser(input.uid, {
      email: input.email,
      password: input.password,
      disabled: input.disabled ?? false,
    });
  }
}

export async function seedDemoFixtures(
  environment: Record<string, string | undefined> = process.env,
) {
  assertDemoSeedEnvironment(environment);
  const firebase = initializeOperatorFirebase(environment);
  if (firebase.mode !== "emulator") throw new Error("Demo seeding refuses cloud mode.");

  const passwords = {
    admin: newEphemeralPassword(),
    ordinary: newEphemeralPassword(),
    disabled: newEphemeralPassword(),
  };
  await ensureUser(firebase.auth, {
    uid: "auth-admin-candidate",
    email: "admin@example.test",
    password: passwords.admin,
  });
  await ensureUser(firebase.auth, {
    uid: "auth-ordinary-candidate",
    email: "ordinary@example.test",
    password: passwords.ordinary,
  });
  await ensureUser(firebase.auth, {
    uid: "auth-disabled-candidate",
    email: "disabled@example.test",
    password: passwords.disabled,
    disabled: true,
  });
  await firebase.auth.setCustomUserClaims("auth-admin-candidate", {
    admin: true,
    demoMarker: "preserve-me",
  });
  await firebase.auth.setCustomUserClaims("auth-ordinary-candidate", {
    demoMarker: "ordinary-user",
  });
  await firebase.auth.setCustomUserClaims("auth-disabled-candidate", { admin: true });

  return {
    projectId: firebase.projectId,
    identities: {
      admin: { uid: "auth-admin-candidate", email: "admin@example.test", password: passwords.admin },
      ordinary: {
        uid: "auth-ordinary-candidate",
        email: "ordinary@example.test",
        password: passwords.ordinary,
      },
      disabled: {
        uid: "auth-disabled-candidate",
        email: "disabled@example.test",
        password: passwords.disabled,
      },
    },
    profilelessAdmin: true,
  };
}

async function main(): Promise<void> {
  configureDemoFirebaseEnvironment();
  try {
    const result = await seedDemoFixtures();
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown demo seed failure.";
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void main();
}
