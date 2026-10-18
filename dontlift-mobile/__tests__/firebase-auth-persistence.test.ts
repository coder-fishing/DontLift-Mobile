const mockStorage = { getItem: jest.fn(), setItem: jest.fn(), removeItem: jest.fn() };
const mockPersistence = {};
const mockInitializeAuth = jest.fn();
const mockGetAuth = jest.fn();
const mockGetPersistence = jest.fn(() => mockPersistence);
let initializeFirebaseAuth: typeof import('../src/features/auth/firebase-auth-client.native').initializeFirebaseAuth;
beforeEach(() => {
  jest.resetModules();
  jest.doMock('@react-native-async-storage/async-storage', () => ({ __esModule: true, default: mockStorage }));
  jest.doMock('firebase/auth', () => ({ initializeAuth: mockInitializeAuth, getAuth: mockGetAuth, getReactNativePersistence: mockGetPersistence }));
  initializeFirebaseAuth = require('../src/features/auth/firebase-auth-client.native').initializeFirebaseAuth;
});
import type { FirebaseApp } from 'firebase/app';
const app = {} as FirebaseApp;
beforeEach(() => jest.clearAllMocks());
test('delegates persistence to the Firebase SDK with AsyncStorage', () => {
  initializeFirebaseAuth(app);
  expect(mockGetPersistence).toHaveBeenCalledWith(mockStorage);
  expect(mockInitializeAuth).toHaveBeenCalledWith(app, { persistence: mockPersistence });
});
test('reuses the existing Auth instance after Fast Refresh', () => {
  mockInitializeAuth.mockImplementationOnce(() => { throw { code: 'auth/already-initialized' }; });
  initializeFirebaseAuth(app); expect(mockGetAuth).toHaveBeenCalledWith(app);
});
test('does not hide other SDK initialization errors', () => {
  mockInitializeAuth.mockImplementationOnce(() => { throw new Error('persistence failed'); });
  expect(() => initializeFirebaseAuth(app)).toThrow('persistence failed'); expect(mockGetAuth).not.toHaveBeenCalled();
});
