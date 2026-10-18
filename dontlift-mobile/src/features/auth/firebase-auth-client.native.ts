import AsyncStorage from '@react-native-async-storage/async-storage';
import type { FirebaseApp } from 'firebase/app';
import { getAuth, getReactNativePersistence, initializeAuth } from 'firebase/auth';

export function initializeFirebaseAuth(app: FirebaseApp) {
  try {
    // SDK tự lưu và làm mới phiên đăng nhập; không chép token vào bảng SQLite của ứng dụng.
    return initializeAuth(app, { persistence: getReactNativePersistence(AsyncStorage) });
  } catch (error) {
    // Fast Refresh có thể nạp lại module sau khi Firebase Auth đã được khởi tạo.
    if ((error as { code?: string }).code === 'auth/already-initialized') return getAuth(app);
    throw error;
  }
}
