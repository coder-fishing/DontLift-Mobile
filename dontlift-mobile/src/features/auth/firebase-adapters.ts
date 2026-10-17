import {
  FirebaseRuntimeConfigurationError,
  FirebaseRuntimeConfig,
  FirebaseRuntimeSettings,
  resolveFirebaseRuntimeConfig,
} from './firebase-runtime-config';
import * as Crypto from 'expo-crypto';
import { createAuthController } from './auth-controller';
import type { RegistrationRequest, RegistrationResponse, RegistrationUser } from './auth-controller';
import { createLocalProfileRepository } from './local-profile-repository';

export interface FirebaseRuntime {
  config: FirebaseRuntimeConfig;
  app: ReturnType<typeof import('@react-native-firebase/app').getApp>;
  auth: ReturnType<typeof import('@react-native-firebase/auth').getAuth>;
  firestore: ReturnType<typeof import('@react-native-firebase/firestore').getFirestore>;
  functions: ReturnType<typeof import('@react-native-firebase/functions').getFunctions>;
}

let runtime: FirebaseRuntime | undefined;
let initializationFailure: FirebaseRuntimeConfigurationError | undefined;

const FIRESTORE_DIAGNOSTIC_CODES = new Set([
  'cancelled', 'unknown', 'invalid-argument', 'deadline-exceeded', 'not-found', 'already-exists',
  'permission-denied', 'resource-exhausted', 'failed-precondition', 'aborted', 'out-of-range',
  'unimplemented', 'internal', 'unavailable', 'data-loss', 'unauthenticated',
]);

function safeDiagnosticDetail(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null || !('message' in error) || typeof error.message !== 'string') {
    return undefined;
  }

  const detail = error.message
    .replace(/projects\/[^/\s]+\/databases\/[^/\s]+\/documents\/\S+/gi, '<Firestore document>')
    .replace(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g, '<email>')
    .replace(/\b(api[_-]?key|token|authorization)\s*[:=]\s*[^\s,;]+/gi, '$1=<redacted>')
    .replace(/\b(?:AIza[\w-]{20,}|[A-Za-z0-9_-]{32,})\b/g, '<redacted>')
    .slice(0, 240);

  return detail || undefined;
}

export function initializeFirebaseRuntime(settings: FirebaseRuntimeSettings): FirebaseRuntime {
  const config = resolveFirebaseRuntimeConfig(settings);
  if (runtime) {
    if (JSON.stringify(runtime.config) !== JSON.stringify(config)) {
      throw new FirebaseRuntimeConfigurationError('restart-required', 'Restart the app before changing Firebase runtime configuration.');
    }
    return runtime;
  }
  if (initializationFailure) throw initializationFailure;

  try {
    // Load native modules only after platform and environment checks; web keeps its prototype runtime.
    const appSdk = require('@react-native-firebase/app') as typeof import('@react-native-firebase/app');
    const app = appSdk.getApp();
    if (app.options.projectId !== config.projectId) {
      throw new FirebaseRuntimeConfigurationError('native-project-mismatch', 'Native Firebase config does not match the expected project.');
    }

    const authSdk = require('@react-native-firebase/auth') as typeof import('@react-native-firebase/auth');
    const firestoreSdk = require('@react-native-firebase/firestore') as typeof import('@react-native-firebase/firestore');
    const functionsSdk = require('@react-native-firebase/functions') as typeof import('@react-native-firebase/functions');
    const auth = authSdk.getAuth(app);
    const firestore = firestoreSdk.getFirestore(app);
    const functions = functionsSdk.getFunctions(app, config.region);

    if (config.emulator) {
      const { host, authPort, firestorePort, functionsPort } = config.emulator;
      authSdk.connectAuthEmulator(auth, `http://${host}:${authPort}`, { disableWarnings: true });
      firestoreSdk.connectFirestoreEmulator(firestore, host, firestorePort);
      functionsSdk.connectFunctionsEmulator(functions, host, functionsPort);
    }

    runtime = { config, app, auth, firestore, functions };
    return runtime;
  } catch (error) {
    initializationFailure = error instanceof FirebaseRuntimeConfigurationError
      ? error
      : new FirebaseRuntimeConfigurationError('native-runtime-unavailable', 'Firebase native modules are unavailable. Rebuild the development app with the required SDKs.');
    throw initializationFailure;
  }
}

export function getConfiguredFirebaseRuntime(platform: string, isDevelopment: boolean): FirebaseRuntime {
  return initializeFirebaseRuntime({
    platform,
    isDevelopment,
    mode: process.env.EXPO_PUBLIC_FIREBASE_RUNTIME_MODE,
    developmentProjectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
    productionProjectId: process.env.EXPO_PUBLIC_FIREBASE_PRODUCTION_PROJECT_ID,
    emulatorHost: process.env.EXPO_PUBLIC_FIREBASE_EMULATOR_HOST,
    authEmulatorPort: process.env.EXPO_PUBLIC_FIREBASE_AUTH_EMULATOR_PORT,
    firestoreEmulatorPort: process.env.EXPO_PUBLIC_FIREBASE_FIRESTORE_EMULATOR_PORT,
    functionsEmulatorPort: process.env.EXPO_PUBLIC_FIREBASE_FUNCTIONS_EMULATOR_PORT,
  });
}

export function createFirebaseRegistrationController(current: FirebaseRuntime) {
  const authSdk = require('@react-native-firebase/auth') as typeof import('@react-native-firebase/auth');
  const functionsSdk = require('@react-native-firebase/functions') as typeof import('@react-native-firebase/functions');
  const completeProfile = functionsSdk.httpsCallable<RegistrationRequest, RegistrationResponse>(
    current.functions,
    'completeRegistrationProfile',
  );

  return createAuthController({
    getCurrentUser: () => current.auth.currentUser,
    onAuthStateChanged(listener) {
      return authSdk.onAuthStateChanged(current.auth, listener);
    },
    async createAccount(email, password) {
      const credential = await authSdk.createUserWithEmailAndPassword(current.auth, email, password);
      return credential.user;
    },
    async setDisplayName(user, displayName) {
      const currentUser = current.auth.currentUser;
      if (!currentUser || currentUser.uid !== user.uid) throw new Error('Registration session changed.');
      await authSdk.updateProfile(currentUser, { displayName });
    },
    async completeProfile(request) {
      return (await completeProfile(request)).data;
    },
  }, createLocalProfileRepository(), Crypto.randomUUID);
}

export function firebaseRuntimeDiagnostics(current: FirebaseRuntime) {
  return {
    platform: current.config.platform,
    environment: current.config.environment,
    mode: current.config.mode,
    projectId: current.config.projectId,
    functionsRegion: current.config.region,
    authState: current.auth.currentUser ? 'signed-in' : 'signed-out',
    nativeClients: 'initialized',
  };
}

export async function probeFirebaseConnection(current: FirebaseRuntime, timeoutMs = 10000) {
  if (current.config.environment !== 'development') {
    throw new FirebaseRuntimeConfigurationError('development-probe-only', 'The connectivity probe is development-only.');
  }
  const sdk = require('@react-native-firebase/firestore') as typeof import('@react-native-firebase/firestore');
  // This is a read-only probe of an existing resource namespace. Never create a user or write test data.
  const userId = current.auth.currentUser?.uid ?? 'sl002_connection_probe';
  const read = sdk.getDocFromServer(sdk.doc(current.firestore, 'users', userId));
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      read,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject({ code: 'runtime/timeout' }), timeoutMs);
      }),
    ]);
    return { ...firebaseRuntimeDiagnostics(current), firestoreConnection: 'server-read-completed' };
  } catch (error) {
    const code = typeof error === 'object' && error !== null && 'code' in error && typeof error.code === 'string'
      ? error.code
      : 'runtime/unknown';
    const normalizedCode = code.startsWith('firestore/') ? code.slice('firestore/'.length) : code;
    const denied = normalizedCode === 'permission-denied';
    // Only expose sanitized details for malformed-request diagnosis; keep other raw SDK errors hidden.
    const errorDetail = normalizedCode === 'invalid-argument' ? safeDiagnosticDetail(error) : undefined;
    return {
      ...firebaseRuntimeDiagnostics(current),
      firestoreConnection: denied ? 'server-reached-access-denied' : 'unverified',
      errorCode: code === 'runtime/timeout'
        ? 'timeout'
        : FIRESTORE_DIAGNOSTIC_CODES.has(normalizedCode) ? normalizedCode : 'connection-failed',
      ...(errorDetail ? { errorDetail } : {}),
    };
  } finally {
    if (timer) clearTimeout(timer);
  }
}
