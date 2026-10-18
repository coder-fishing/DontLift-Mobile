import 'firebase/auth';
import type { Persistence } from 'firebase/auth';

declare module 'firebase/auth' {
  // Firebase export hàm này ở React Native runtime nhưng bỏ sót trong public .d.ts.
  export function getReactNativePersistence(storage: {
    getItem(key: string): Promise<string | null>;
    setItem(key: string, value: string): Promise<void>;
    removeItem(key: string): Promise<void>;
  }): Persistence;
}
