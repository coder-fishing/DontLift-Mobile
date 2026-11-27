import { applicationDefault, getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import { FirebaseConfigError, parseFirebaseRuntimeConfig } from "../../src/lib/firebase/config";

export class OperatorEnvironmentError extends Error {
  readonly code = "invalid-configuration";
  readonly exitCode = 2;

  constructor(message: string) {
    super(message);
    this.name = "OperatorEnvironmentError";
  }
}

export interface OperatorFirebase {
  app: App;
  auth: Auth;
  firestore: Firestore;
  mode: "emulator" | "cloud";
  projectId: string;
}

export function initializeOperatorFirebase(
  environment: Record<string, string | undefined> = process.env,
): OperatorFirebase {
  let runtime;
  try {
    runtime = parseFirebaseRuntimeConfig(environment);
  } catch (error) {
    if (error instanceof FirebaseConfigError) throw new OperatorEnvironmentError(error.message);
    throw error;
  }
  const operatorMode = environment.ADMIN_OPERATOR_MODE;
  const operatorProjectId = environment.ADMIN_OPERATOR_PROJECT_ID;
  if (operatorMode !== "emulator" && operatorMode !== "cloud") {
    throw new OperatorEnvironmentError("ADMIN_OPERATOR_MODE must explicitly be emulator or cloud.");
  }
  if (operatorProjectId !== runtime.projectId) {
    throw new OperatorEnvironmentError("Operator and Firebase project IDs must match.");
  }
  if ((operatorMode === "emulator") !== (runtime.mode === "demo")) {
    throw new OperatorEnvironmentError("Operator mode and Firebase runtime mode must match.");
  }

  const existing = getApps().find((candidate) => candidate.name === "dontlift-admin-operator");
  if (existing && existing.options.projectId !== runtime.projectId) {
    throw new OperatorEnvironmentError("Existing operator Firebase app project does not match configuration.");
  }
  const app = existing ?? initializeApp(
    {
      projectId: runtime.projectId,
      ...(operatorMode === "cloud" ? { credential: applicationDefault() } : {}),
    },
    "dontlift-admin-operator",
  );

  return {
    app,
    auth: getAuth(app),
    firestore: getFirestore(app),
    mode: operatorMode,
    projectId: runtime.projectId,
  };
}
