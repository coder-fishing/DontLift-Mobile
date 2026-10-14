const mockApp = { options: { projectId: 'dontlift-test-development', apiKey: 'not-for-logs' } };
const mockAuth: { currentUser: { uid: string; email?: string } | null } = { currentUser: null };
const mockFirestore = {};
const mockFunctions = {};
const mockGetApp = jest.fn(() => mockApp);
const mockGetAuth = jest.fn(() => mockAuth);
const mockGetFirestore = jest.fn(() => mockFirestore);
const mockGetFunctions = jest.fn(() => mockFunctions);
const mockConnectAuth = jest.fn();
const mockConnectFirestore = jest.fn();
const mockConnectFunctions = jest.fn();
const mockDoc = jest.fn(() => ({}));
const mockRead = jest.fn();

let sdk: typeof import('../src/features/auth/firebase-adapters');
const development = {
  platform: 'android', isDevelopment: true, developmentProjectId: 'dontlift-test-development',
};

beforeEach(() => {
  jest.resetModules();
  jest.clearAllMocks();
  mockApp.options.projectId = development.developmentProjectId;
  mockAuth.currentUser = null;
  mockRead.mockResolvedValue({});
  jest.doMock('@react-native-firebase/app', () => ({ getApp: mockGetApp }));
  jest.doMock('@react-native-firebase/auth', () => ({
    getAuth: mockGetAuth, connectAuthEmulator: mockConnectAuth,
  }));
  jest.doMock('@react-native-firebase/firestore', () => ({
    getFirestore: mockGetFirestore,
    connectFirestoreEmulator: mockConnectFirestore,
    doc: mockDoc,
    getDocFromServer: mockRead,
  }));
  jest.doMock('@react-native-firebase/functions', () => ({
    getFunctions: mockGetFunctions, connectFunctionsEmulator: mockConnectFunctions,
  }));
  sdk = require('../src/features/auth/firebase-adapters') as typeof import('../src/features/auth/firebase-adapters');
});

afterEach(() => jest.useRealTimers());

test('validates the environment before asking the native SDK for an app', () => {
  expect(() => sdk.initializeFirebaseRuntime({ ...development, developmentProjectId: '' })).toThrow('project');
  expect(mockGetApp).not.toHaveBeenCalled();
});

test('rejects a mismatched native project without constructing service clients', () => {
  mockApp.options.projectId = 'another-test-project';
  expect(() => sdk.initializeFirebaseRuntime(development)).toThrow('expected project');
  expect(mockGetAuth).not.toHaveBeenCalled();
  expect(mockGetFirestore).not.toHaveBeenCalled();
});

test('initializes all cloud clients with the approved Functions region', () => {
  const runtime = sdk.initializeFirebaseRuntime(development);
  expect(runtime.auth).toBe(mockAuth);
  expect(mockGetFunctions).toHaveBeenCalledWith(mockApp, 'asia-southeast1');
  expect(mockConnectAuth).not.toHaveBeenCalled();
  expect(mockConnectFirestore).not.toHaveBeenCalled();
  expect(mockConnectFunctions).not.toHaveBeenCalled();
});

test('reuses clients instead of reconfiguring emulators on remount', () => {
  const first = sdk.initializeFirebaseRuntime(development);
  expect(sdk.initializeFirebaseRuntime(development)).toBe(first);
  expect(mockGetFunctions).toHaveBeenCalledTimes(1);
  expect(() => sdk.initializeFirebaseRuntime({ ...development, developmentProjectId: 'changed-test-project' }))
    .toThrow('Restart');
});

test('routes each native client to its explicitly configured emulator', () => {
  sdk.initializeFirebaseRuntime({
    ...development,
    mode: 'emulator',
    emulatorHost: '127.0.0.1',
    authEmulatorPort: '9099',
    firestoreEmulatorPort: '8080',
    functionsEmulatorPort: '5001',
  });
  expect(mockConnectAuth).toHaveBeenCalledWith(mockAuth, 'http://127.0.0.1:9099', { disableWarnings: true });
  expect(mockConnectFirestore).toHaveBeenCalledWith(mockFirestore, '127.0.0.1', 8080);
  expect(mockConnectFunctions).toHaveBeenCalledWith(mockFunctions, '127.0.0.1', 5001);
});

test('reports native module failure without leaking raw SDK details', () => {
  mockGetApp.mockImplementationOnce(() => { throw new Error('sensitive configuration'); });
  expect(() => sdk.initializeFirebaseRuntime(development)).toThrow('Rebuild');
  expect(() => sdk.initializeFirebaseRuntime(development)).not.toThrow('sensitive configuration');
  expect(mockGetApp).toHaveBeenCalledTimes(1);
});

test('safe diagnostics do not contain credentials or user identity', () => {
  mockAuth.currentUser = { uid: 'private-user-id', email: 'private@example.test' };
  const diagnostics = JSON.stringify(sdk.firebaseRuntimeDiagnostics(sdk.initializeFirebaseRuntime(development)));
  expect(diagnostics).toContain('signed-in');
  expect(diagnostics).not.toContain('private');
  expect(diagnostics).not.toContain('not-for-logs');
});

test('permission-denied confirms server reachability without claiming authorized access', async () => {
  mockRead.mockRejectedValue({ code: 'firestore/permission-denied' });
  const result = await sdk.probeFirebaseConnection(sdk.initializeFirebaseRuntime(development));
  expect(result.firestoreConnection).toBe('server-reached-access-denied');
  expect(mockDoc).toHaveBeenCalledWith(mockFirestore, 'users', 'sl002_connection_probe');
});

test('an authenticated probe reads only the current user resource', async () => {
  mockAuth.currentUser = { uid: 'test-owner' };
  const result = await sdk.probeFirebaseConnection(sdk.initializeFirebaseRuntime(development));
  expect(result.firestoreConnection).toBe('server-read-completed');
  expect(mockDoc).toHaveBeenCalledWith(mockFirestore, 'users', 'test-owner');
});

test('network errors never report a successful cloud connection or expose raw details', async () => {
  mockRead.mockRejectedValue({ code: 'firestore/unavailable', message: 'private internal message' });
  const result = await sdk.probeFirebaseConnection(sdk.initializeFirebaseRuntime(development));
  expect(result.firestoreConnection).toBe('unverified');
  expect('errorCode' in result ? result.errorCode : undefined).toBe('unavailable');
  expect(JSON.stringify(result)).not.toContain('private');
});

test('invalid argument diagnostics preserve the reason while redacting identifiers and secrets', async () => {
  mockRead.mockRejectedValue({
    code: 'firestore/invalid-argument',
    message: 'INVALID_ARGUMENT: Bad resource projects/sample-project/databases/(default)/documents/users/private-user-id apiKey=AIzaSuperSecretApiKeyValue',
  });
  const result = await sdk.probeFirebaseConnection(sdk.initializeFirebaseRuntime(development));
  expect('errorCode' in result ? result.errorCode : undefined).toBe('invalid-argument');
  expect('errorDetail' in result ? result.errorDetail : undefined).toContain('INVALID_ARGUMENT: Bad resource');
  expect(JSON.stringify(result)).not.toContain('private-user-id');
  expect(JSON.stringify(result)).not.toContain('AIzaSuperSecretApiKeyValue');
});

test('a stalled server read times out instead of hanging indefinitely', async () => {
  jest.useFakeTimers();
  mockRead.mockReturnValue(new Promise(() => {}));
  const result = sdk.probeFirebaseConnection(sdk.initializeFirebaseRuntime(development));
  jest.advanceTimersByTime(10000);
  await expect(result).resolves.toMatchObject({ firestoreConnection: 'unverified', errorCode: 'timeout' });
});

test('production runtime cannot run the development connectivity probe', async () => {
  const current = sdk.initializeFirebaseRuntime(development);
  await expect(sdk.probeFirebaseConnection({ ...current, config: { ...current.config, environment: 'production' } }))
    .rejects.toThrow('development-only');
  expect(mockRead).not.toHaveBeenCalled();
});
