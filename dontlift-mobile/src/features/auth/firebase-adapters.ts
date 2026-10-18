import { getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import { createUserWithEmailAndPassword, onAuthStateChanged, signInWithEmailAndPassword, signOut, updateProfile, type Auth } from 'firebase/auth';
import { connectAuthEmulator } from 'firebase/auth';
import { connectFirestoreEmulator, doc, getDocFromServer, getFirestore, type Firestore } from 'firebase/firestore';
import * as Crypto from 'expo-crypto';
import { initializeFirebaseAuth } from './firebase-auth-client';
import { FirebaseRuntimeConfigurationError, resolveFirebaseRuntimeConfig, type FirebaseRuntimeConfig, type FirebaseRuntimeSettings } from './firebase-runtime-config';
import { createAuthController } from './auth-controller';
import { createAuthSessionController } from './auth-session-controller';
import { createAuthSessionProfileRepository, createLocalProfileRepository } from './local-profile-repository';
import { completeRegistrationProfile, readRegistrationProfile } from './firebase-profile';

export interface FirebaseRuntime {
  config: FirebaseRuntimeConfig;
  app: FirebaseApp;
  auth: Auth;
  firestore: Firestore;
}
let runtime: FirebaseRuntime | undefined;

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
  const app = getApps().find((candidate) => candidate.name === '[DEFAULT]') ?? initializeApp(config.firebaseOptions);
  if (app.options.projectId !== config.projectId || app.options.appId !== config.firebaseOptions.appId) {
    throw new FirebaseRuntimeConfigurationError('project-mismatch', 'Firebase Web App config does not match the expected project.');
  }
  const auth = initializeFirebaseAuth(app);
  const firestore = getFirestore(app);
  if (config.emulator) {
    const { host, authPort, firestorePort } = config.emulator;
    connectAuthEmulator(auth, 'http://' + host + ':' + authPort, { disableWarnings: true });
    connectFirestoreEmulator(firestore, host, firestorePort);
  }
  runtime = { config, app, auth, firestore };
  return runtime;
}

export function getConfiguredFirebaseRuntime(platform: string, isDevelopment: boolean): FirebaseRuntime {
  return initializeFirebaseRuntime({
    platform, isDevelopment,
    mode: process.env.EXPO_PUBLIC_FIREBASE_RUNTIME_MODE,
    developmentProjectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
    productionProjectId: process.env.EXPO_PUBLIC_FIREBASE_PRODUCTION_PROJECT_ID,
    apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
    appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
    authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
    emulatorHost: process.env.EXPO_PUBLIC_FIREBASE_EMULATOR_HOST,
    authEmulatorPort: process.env.EXPO_PUBLIC_FIREBASE_AUTH_EMULATOR_PORT,
    firestoreEmulatorPort: process.env.EXPO_PUBLIC_FIREBASE_FIRESTORE_EMULATOR_PORT,
  });
}

export function createFirebaseRegistrationController(current: FirebaseRuntime) {
  return createAuthController({
    getCurrentUser: () => current.auth.currentUser,
    onAuthStateChanged: (listener) => onAuthStateChanged(current.auth, listener),
    async createAccount(email, password) {
      return (await createUserWithEmailAndPassword(current.auth, email, password)).user;
    },
    async setDisplayName(user, displayName) {
      const active = current.auth.currentUser;
      if (!active || active.uid !== user.uid) throw new Error('Registration session changed.');
      await updateProfile(active, { displayName });
    },
    completeProfile: (request) => completeRegistrationProfile(current.auth, current.firestore, request),
  }, createLocalProfileRepository(), Crypto.randomUUID, (stage, error) => {
    if (!__DEV__) return;
    const code = typeof error === 'object' && error !== null && 'code' in error && typeof error.code === 'string'
      && /^[a-zA-Z0-9_/-]{1,80}$/.test(error.code) ? error.code : 'unknown';
    let detail = safeDiagnosticDetail(error);
    for (const value of [current.auth.currentUser?.uid, current.auth.currentUser?.email, current.auth.currentUser?.displayName]) {
      if (value) detail = detail?.split(value).join('<user>');
    }
    console.warn('[registration-profile] completion-failed', JSON.stringify({ stage, code, detail }));
  });
}

export function createFirebaseAuthSessionController(current: FirebaseRuntime) {
  return createAuthSessionController({
    getCurrentUser: () => current.auth.currentUser,
    async signIn(email, password) {
      return (await signInWithEmailAndPassword(current.auth, email, password)).user;
    },
    signOut: () => signOut(current.auth),
  }, createAuthSessionProfileRepository(), {
    async get(uid) {
      if (current.auth.currentUser?.uid !== uid) throw new Error('The active account changed.');
      const snapshot = await getDocFromServer(doc(current.firestore, 'users', uid));
      if (!snapshot.exists() || current.auth.currentUser?.uid !== uid) return null;
      return readRegistrationProfile(uid, snapshot.data());
    },
  });
}

export function firebaseRuntimeDiagnostics(current: FirebaseRuntime) {
  return {
    platform: current.config.platform, environment: current.config.environment,
    mode: current.config.mode, projectId: current.config.projectId,
    authState: current.auth.currentUser ? 'signed-in' : 'signed-out', sdk: 'firebase-js',
  };
}

export async function probeFirebaseConnection(current: FirebaseRuntime, timeoutMs = 10000) {
  if (current.config.environment !== 'development') {
    throw new FirebaseRuntimeConfigurationError('development-probe-only', 'The connectivity probe is development-only.');
  }
  // This is a read-only probe of an existing resource namespace. Never create a user or write test data.
  const userId = current.auth.currentUser?.uid ?? 'sl002_connection_probe';
  const read = getDocFromServer(doc(current.firestore, 'users', userId));
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
