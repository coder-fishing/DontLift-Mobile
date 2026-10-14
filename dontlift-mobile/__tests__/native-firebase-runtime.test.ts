import { resolveFirebaseRuntimeConfig } from '../src/features/auth/firebase-runtime-config';

const development = {
  platform: 'android',
  isDevelopment: true,
  developmentProjectId: 'dontlift-test-development',
};

describe('Firebase environment boundary', () => {
  test('uses the approved existing cloud project in development', () => {
    expect(resolveFirebaseRuntimeConfig(development)).toMatchObject({
      mode: 'cloud',
      environment: 'development',
      projectId: development.developmentProjectId,
      region: 'asia-southeast1',
    });
  });

  test('supports the same cloud configuration on iOS', () => {
    expect(resolveFirebaseRuntimeConfig({ ...development, platform: 'ios' })).toMatchObject({
      projectId: development.developmentProjectId,
    });
  });

  test('rejects missing expected project before loading native clients', () => {
    expect(() => resolveFirebaseRuntimeConfig({ ...development, developmentProjectId: '' }))
      .toThrow('project');
  });

  test('rejects unsupported web runtime', () => {
    expect(() => resolveFirebaseRuntimeConfig({ ...development, platform: 'web' }))
      .toThrow('native');
  });

  test('requires explicit production configuration for a release binary', () => {
    expect(() => resolveFirebaseRuntimeConfig({ ...development, isDevelopment: false }))
      .toThrow('production');
  });

  test('rejects production reuse of the development project', () => {
    expect(() => resolveFirebaseRuntimeConfig({
      ...development,
      isDevelopment: false,
      mode: 'cloud',
      productionProjectId: development.developmentProjectId,
    })).toThrow('distinct');
  });

  test('rejects emulator mode in release', () => {
    expect(() => resolveFirebaseRuntimeConfig({
      ...development, isDevelopment: false, mode: 'emulator',
    })).toThrow('emulator');
  });

  test('does not guess an emulator host or ports', () => {
    expect(() => resolveFirebaseRuntimeConfig({ ...development, mode: 'emulator' }))
      .toThrow('host');
  });

  test('accepts explicitly selected emulator host and service ports', () => {
    expect(resolveFirebaseRuntimeConfig({
      ...development,
      mode: 'emulator',
      emulatorHost: '127.0.0.1',
      authEmulatorPort: '9099',
      firestoreEmulatorPort: '8080',
      functionsEmulatorPort: '5001',
    })).toMatchObject({
      mode: 'emulator',
      emulator: { host: '127.0.0.1', authPort: 9099, firestorePort: 8080, functionsPort: 5001 },
    });
  });

  test('rejects a URL masquerading as an emulator hostname', () => {
    expect(() => resolveFirebaseRuntimeConfig({
      ...development, mode: 'emulator', emulatorHost: 'http://127.0.0.1:9099',
    })).toThrow('host');
  });

  test('rejects out-of-range emulator ports', () => {
    expect(() => resolveFirebaseRuntimeConfig({
      ...development,
      mode: 'emulator',
      emulatorHost: '127.0.0.1',
      authEmulatorPort: '70000',
      firestoreEmulatorPort: '8080',
      functionsEmulatorPort: '5001',
    })).toThrow('port');
  });
});
