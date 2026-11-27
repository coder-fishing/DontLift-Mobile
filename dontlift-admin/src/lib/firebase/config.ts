export type FirebaseRuntimeMode = "demo" | "cloud";

export interface FirebaseRuntimeConfig {
  mode: FirebaseRuntimeMode;
  projectId: string;
  authEmulatorHost: string | null;
  firestoreEmulatorHost: string | null;
  browserAuthEmulatorUrl: string | null;
}

export interface FirebaseWebConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  appId: string;
  authEmulatorUrl: string | null;
}

export class FirebaseConfigError extends Error {
  readonly code = "firebase/configuration-error";

  constructor(message: string) {
    super(message);
    this.name = "FirebaseConfigError";
  }
}

type Environment = Record<string, string | undefined>;

function required(environment: Environment, key: string): string {
  const value = environment[key]?.trim();
  if (!value) throw new FirebaseConfigError(`Missing required setting: ${key}`);
  return value;
}

function isLoopbackHost(host: string): boolean {
  const normalized = host.toLowerCase().replace(/^\[|\]$/g, "");
  return normalized === "localhost" || normalized === "127.0.0.1" || normalized === "::1";
}

function validateHostPort(value: string, key: string): void {
  let parsed: URL;
  try {
    parsed = new URL(`http://${value}`);
  } catch {
    throw new FirebaseConfigError(`${key} must be a host:port value.`);
  }
  if (!parsed.hostname || !parsed.port || parsed.pathname !== "/") {
    throw new FirebaseConfigError(`${key} must be a host:port value.`);
  }
  if (!isLoopbackHost(parsed.hostname)) {
    throw new FirebaseConfigError(`${key} must use a loopback host in demo mode.`);
  }
}

function validateBrowserEmulatorUrl(value: string): void {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new FirebaseConfigError("NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_URL must be a URL.");
  }
  if (parsed.protocol !== "http:" || !isLoopbackHost(parsed.hostname) || !parsed.port) {
    throw new FirebaseConfigError(
      "NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_URL must be an http loopback URL with a port.",
    );
  }
}

export function parseFirebaseRuntimeConfig(environment: Environment): FirebaseRuntimeConfig {
  const modeValue = required(environment, "FIREBASE_RUNTIME_MODE");
  if (modeValue !== "demo" && modeValue !== "cloud") {
    throw new FirebaseConfigError("FIREBASE_RUNTIME_MODE must be demo or cloud.");
  }
  const mode = modeValue;
  const browserMode = required(environment, "NEXT_PUBLIC_FIREBASE_RUNTIME_MODE");
  if (browserMode !== mode) {
    throw new FirebaseConfigError("Browser and server Firebase runtime modes must match.");
  }
  const projectId = required(environment, "FIREBASE_PROJECT_ID");
  const browserProjectId = required(environment, "NEXT_PUBLIC_FIREBASE_PROJECT_ID");
  if (projectId !== browserProjectId) {
    throw new FirebaseConfigError("Browser and server Firebase project IDs must match.");
  }

  const authEmulatorHost = environment.FIREBASE_AUTH_EMULATOR_HOST?.trim() || null;
  const firestoreEmulatorHost = environment.FIRESTORE_EMULATOR_HOST?.trim() || null;
  const browserAuthEmulatorUrl =
    environment.NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_URL?.trim() || null;

  if (mode === "demo") {
    if (!projectId.startsWith("demo-")) {
      throw new FirebaseConfigError("Demo mode requires a demo-* project ID.");
    }
    if (!authEmulatorHost || !firestoreEmulatorHost || !browserAuthEmulatorUrl) {
      throw new FirebaseConfigError("Demo mode requires browser, Auth, and Firestore emulator endpoints.");
    }
    validateHostPort(authEmulatorHost, "FIREBASE_AUTH_EMULATOR_HOST");
    validateHostPort(firestoreEmulatorHost, "FIRESTORE_EMULATOR_HOST");
    validateBrowserEmulatorUrl(browserAuthEmulatorUrl);
  } else {
    if (projectId.startsWith("demo-")) {
      throw new FirebaseConfigError("Cloud mode cannot use a demo-* project ID.");
    }
    if (authEmulatorHost || firestoreEmulatorHost || browserAuthEmulatorUrl) {
      throw new FirebaseConfigError("Cloud mode cannot use Firebase Emulator endpoints.");
    }
  }

  return {
    mode,
    projectId,
    authEmulatorHost,
    firestoreEmulatorHost,
    browserAuthEmulatorUrl,
  };
}

export function getFirebaseRuntimeConfig(): FirebaseRuntimeConfig {
  return parseFirebaseRuntimeConfig(process.env);
}

export function getFirebaseWebConfig(): FirebaseWebConfig {
  // Next.js only inlines NEXT_PUBLIC_* variables when each reference is static.
  // Keep these direct reads; dynamic process.env[key] access is empty in browser bundles.
  const environment: Environment = {
    NEXT_PUBLIC_FIREBASE_RUNTIME_MODE: process.env.NEXT_PUBLIC_FIREBASE_RUNTIME_MODE,
    NEXT_PUBLIC_FIREBASE_PROJECT_ID: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_URL: process.env.NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_URL,
    NEXT_PUBLIC_FIREBASE_API_KEY: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    NEXT_PUBLIC_FIREBASE_APP_ID: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  };
  const mode = required(environment, "NEXT_PUBLIC_FIREBASE_RUNTIME_MODE");
  const projectId = required(environment, "NEXT_PUBLIC_FIREBASE_PROJECT_ID");
  const authEmulatorUrl = environment.NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_URL?.trim() || null;
  if (mode !== "demo" && mode !== "cloud") {
    throw new FirebaseConfigError("NEXT_PUBLIC_FIREBASE_RUNTIME_MODE must be demo or cloud.");
  }
  if (mode === "demo") {
    if (!projectId.startsWith("demo-") || !authEmulatorUrl) {
      throw new FirebaseConfigError("Browser demo mode requires a demo project and Auth emulator.");
    }
    validateBrowserEmulatorUrl(authEmulatorUrl);
  } else if (projectId.startsWith("demo-") || authEmulatorUrl) {
    throw new FirebaseConfigError("Browser cloud mode cannot use demo emulator settings.");
  }
  return {
    apiKey: required(environment, "NEXT_PUBLIC_FIREBASE_API_KEY"),
    authDomain: required(environment, "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN"),
    projectId,
    appId: required(environment, "NEXT_PUBLIC_FIREBASE_APP_ID"),
    authEmulatorUrl,
  };
}
