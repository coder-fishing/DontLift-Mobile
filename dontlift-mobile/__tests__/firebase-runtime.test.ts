import { resolveFirebaseRuntimeConfig } from '../src/features/auth/firebase-runtime-config';

const development = {
  platform: 'android',
  isDevelopment: true,
  developmentProjectId: 'dontlift-test-development', apiKey: 'test-api', appId: 'test-app', authDomain: 'test.firebaseapp.com',
};

describe('Firebase environment boundary', () => {
  test('uses the approved existing cloud project in development', () => {
    expect(resolveFirebaseRuntimeConfig(development)).toMatchObject({
      mode: 'cloud',
      environment: 'development',
      projectId: development.developmentProjectId,
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

  test('accepts web config with the JS SDK', () => {
    expect(resolveFirebaseRuntimeConfig({ ...development, platform: 'web' }).platform).toBe('web');
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
    })).toMatchObject({
      mode: 'emulator',
      emulator: { host: '127.0.0.1', authPort: 9099, firestorePort: 8080 },
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
    })).toThrow('port');
  });
});
