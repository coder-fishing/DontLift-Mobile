import type { FirebaseOptions } from 'firebase/app';

export class FirebaseRuntimeConfigurationError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
    this.name = 'FirebaseRuntimeConfigurationError';
  }
}

export interface FirebaseRuntimeSettings {
  platform: string;
  isDevelopment: boolean;
  mode?: string;
  developmentProjectId?: string;
  productionProjectId?: string;
  apiKey?: string;
  appId?: string;
  authDomain?: string;
  emulatorHost?: string;
  authEmulatorPort?: string;
  firestoreEmulatorPort?: string;
}

export interface FirebaseRuntimeConfig {
  platform: 'android' | 'ios' | 'web';
  environment: 'development' | 'production';
  mode: 'cloud' | 'emulator';
  projectId: string;
  firebaseOptions: FirebaseOptions;
  emulator?: { host: string; authPort: number; firestorePort: number };
}

function emulatorPort(value: string | undefined): number {
  const port = Number(value);
  if (!value || !/^\d+$/.test(value) || !Number.isInteger(port) || port < 1 || port > 65535) {
    throw new FirebaseRuntimeConfigurationError('invalid-emulator-port', 'An explicit valid emulator port is required.');
  }
  return port;
}

export function resolveFirebaseRuntimeConfig(settings: FirebaseRuntimeSettings): FirebaseRuntimeConfig {
  const { platform } = settings;
  if (platform !== 'android' && platform !== 'ios' && platform !== 'web') {
    throw new FirebaseRuntimeConfigurationError('unsupported-platform', 'Firebase requires Android, iOS or web.');
  }
  const mode = settings.mode ?? (settings.isDevelopment ? 'cloud' : undefined);
  if (!settings.isDevelopment && mode === 'emulator') {
    throw new FirebaseRuntimeConfigurationError('release-emulator-forbidden', 'A release binary cannot use an emulator.');
  }
  if (!settings.isDevelopment && (mode !== 'cloud' || !settings.productionProjectId?.trim())) {
    throw new FirebaseRuntimeConfigurationError('production-not-configured', 'Explicit production mode and a production project are required.');
  }
  if (mode !== 'cloud' && mode !== 'emulator') {
    throw new FirebaseRuntimeConfigurationError('invalid-runtime-mode', 'Firebase runtime mode must be cloud or emulator.');
  }
  const projectId = (settings.isDevelopment ? settings.developmentProjectId : settings.productionProjectId)?.trim();
  if (!projectId) throw new FirebaseRuntimeConfigurationError('missing-project', 'The expected Firebase project is required.');
  if (!settings.isDevelopment && (!settings.developmentProjectId?.trim() || projectId === settings.developmentProjectId.trim())) {
    throw new FirebaseRuntimeConfigurationError('production-not-distinct', 'Production requires a distinct project from development.');
  }
  if (!settings.apiKey?.trim() || !settings.appId?.trim() || !settings.authDomain?.trim()) {
    throw new FirebaseRuntimeConfigurationError('missing-web-config', 'Firebase Web App apiKey, appId and authDomain are required.');
  }
  const config: FirebaseRuntimeConfig = {
    platform,
    environment: settings.isDevelopment ? 'development' : 'production',
    mode,
    projectId,
    firebaseOptions: { projectId, apiKey: settings.apiKey.trim(), appId: settings.appId.trim(), authDomain: settings.authDomain.trim() },
  };
  if (mode === 'emulator') {
    const host = settings.emulatorHost?.trim();
    if (!host || !/^[a-zA-Z0-9.-]+$/.test(host) || host === '0.0.0.0') {
      throw new FirebaseRuntimeConfigurationError('invalid-emulator-host', 'An explicit emulator hostname or IPv4 host is required.');
    }
    config.emulator = { host, authPort: emulatorPort(settings.authEmulatorPort), firestorePort: emulatorPort(settings.firestoreEmulatorPort) };
  }
  return config;
}
