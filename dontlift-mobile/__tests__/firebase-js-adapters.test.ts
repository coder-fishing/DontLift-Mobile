const mockApp = { name: '[DEFAULT]', options: { projectId: 'dontlift-test-development', appId: 'test-app' } };
const mockAuth: { currentUser: { uid: string; email?: string } | null } = { currentUser: null };
const mockFirestore = {};
const mockFunctions = {};
const mockInitializeApp = jest.fn(() => mockApp);
const mockInitializeAuth = jest.fn(() => mockAuth);
const mockGetFirestore = jest.fn(() => mockFirestore);
const mockConnectAuth = jest.fn();
const mockConnectFirestore = jest.fn();
const mockGetFunctions = jest.fn(() => mockFunctions);
const mockConnectFunctions = jest.fn();
const mockRead = jest.fn();
const development = { platform: 'android', isDevelopment: true, developmentProjectId: 'dontlift-test-development', apiKey: 'test-api', appId: 'test-app', authDomain: 'test.firebaseapp.com' };
let sdk: typeof import('../src/features/auth/firebase-adapters');

beforeEach(() => {
  jest.resetModules(); jest.clearAllMocks();
  mockApp.options.projectId = development.developmentProjectId;
  mockAuth.currentUser = null;
  mockRead.mockResolvedValue({});
  jest.doMock('firebase/app', () => ({ getApps: () => [], initializeApp: mockInitializeApp }));
  jest.doMock('firebase/auth', () => ({ connectAuthEmulator: mockConnectAuth }));
  jest.doMock('../src/features/auth/firebase-auth-client', () => ({ initializeFirebaseAuth: mockInitializeAuth }));
  jest.doMock('firebase/firestore', () => ({
    getFirestore: mockGetFirestore, connectFirestoreEmulator: mockConnectFirestore,
    doc: (_db: unknown, ...segments: string[]) => segments.join('/'), getDocFromServer: mockRead,
  }));
  jest.doMock('firebase/functions', () => ({ getFunctions: mockGetFunctions, connectFunctionsEmulator: mockConnectFunctions }));
  sdk = require('../src/features/auth/firebase-adapters');
});

afterEach(() => jest.useRealTimers());

test('validates configuration before constructing SDK clients', () => {
  expect(() => sdk.initializeFirebaseRuntime({ ...development, developmentProjectId: '' })).toThrow('project');
  expect(mockInitializeApp).not.toHaveBeenCalled();
});

test('rejects a mismatched Firebase project', () => {
  mockApp.options.projectId = 'wrong-project';
  expect(() => sdk.initializeFirebaseRuntime(development)).toThrow('expected project');
  expect(mockInitializeAuth).not.toHaveBeenCalled();
});

test('cloud mode uses JS SDK and never connects to emulators', () => {
  expect(sdk.initializeFirebaseRuntime(development).auth).toBe(mockAuth);
  expect(mockInitializeApp).toHaveBeenCalledWith(expect.objectContaining({ projectId: development.developmentProjectId, appId: 'test-app' }));
  expect(mockConnectAuth).not.toHaveBeenCalled(); expect(mockConnectFirestore).not.toHaveBeenCalled();
});

test('reuses clients and rejects changing runtime without restarting', () => {
  const first = sdk.initializeFirebaseRuntime(development);
  expect(sdk.initializeFirebaseRuntime(development)).toBe(first);
  expect(mockInitializeAuth).toHaveBeenCalledTimes(1);
  expect(() => sdk.initializeFirebaseRuntime({ ...development, mode: 'emulator', emulatorHost: 'localhost', authEmulatorPort: '9099', firestoreEmulatorPort: '8080', functionsEmulatorPort: '5001' })).toThrow('Restart');
});

test('explicit emulator mode configures Auth, Firestore and Functions', () => {
  sdk.initializeFirebaseRuntime({ ...development, mode: 'emulator', emulatorHost: '127.0.0.1', authEmulatorPort: '9099', firestoreEmulatorPort: '8080', functionsEmulatorPort: '5001' });
  expect(mockConnectAuth).toHaveBeenCalledWith(mockAuth, 'http://127.0.0.1:9099', { disableWarnings: true });
  expect(mockConnectFirestore).toHaveBeenCalledWith(mockFirestore, '127.0.0.1', 8080);
  expect(mockConnectFunctions).toHaveBeenCalledWith(mockFunctions, '127.0.0.1', 5001);
});

test('diagnostics do not expose client config or identity', () => {
  mockAuth.currentUser = { uid: 'private-user', email: 'private@example.test' };
  const result = JSON.stringify(sdk.firebaseRuntimeDiagnostics(sdk.initializeFirebaseRuntime(development)));
  expect(result).toContain('firebase-js'); expect(result).not.toContain('private'); expect(result).not.toContain('test-api');
});

test('owner profile server read is used by the development connectivity probe', async () => {
  mockAuth.currentUser = { uid: 'test-owner' };
  const result = await sdk.probeFirebaseConnection(sdk.initializeFirebaseRuntime(development));
  expect(mockRead).toHaveBeenCalledWith('users/test-owner');
  expect(result.firestoreConnection).toBe('server-read-completed');
});

test('permission denial proves reachability without claiming access', async () => {
  mockRead.mockRejectedValue({ code: 'permission-denied' });
  await expect(sdk.probeFirebaseConnection(sdk.initializeFirebaseRuntime(development))).resolves.toMatchObject({ firestoreConnection: 'server-reached-access-denied' });
});

test('network failures are reported without leaking raw messages', async () => {
  mockRead.mockRejectedValue({ code: 'unavailable', message: 'private@example.test' });
  const result = await sdk.probeFirebaseConnection(sdk.initializeFirebaseRuntime(development));
  expect(result.firestoreConnection).toBe('unverified'); expect(JSON.stringify(result)).not.toContain('private');
});

test('stalled reads time out and production cannot run the probe', async () => {
  jest.useFakeTimers(); mockRead.mockReturnValue(new Promise(() => {}));
  const runtime = sdk.initializeFirebaseRuntime(development);
  const pending = sdk.probeFirebaseConnection(runtime); jest.advanceTimersByTime(10000);
  await expect(pending).resolves.toMatchObject({ errorCode: 'timeout' });
  await expect(sdk.probeFirebaseConnection({ ...runtime, config: { ...runtime.config, environment: 'production' } })).rejects.toThrow('development-only');
});
