import '../global.css';
import { Stack } from 'expo-router';
import React, { useEffect } from 'react';
import { Platform } from 'react-native';
import { firebaseRuntimeDiagnostics, initializeFirebaseRuntime, probeFirebaseConnection } from '../features/auth/firebase-adapters';
import { FirebaseRuntimeConfigurationError } from '../features/auth/firebase-runtime-config';

export default function RootLayout() {
  useEffect(() => {
    if (Platform.OS === 'web') return;
    try {
      const runtime = initializeFirebaseRuntime({
        platform: Platform.OS,
        isDevelopment: __DEV__,
        mode: process.env.EXPO_PUBLIC_FIREBASE_RUNTIME_MODE,
        developmentProjectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
        productionProjectId: process.env.EXPO_PUBLIC_FIREBASE_PRODUCTION_PROJECT_ID,
        emulatorHost: process.env.EXPO_PUBLIC_FIREBASE_EMULATOR_HOST,
        authEmulatorPort: process.env.EXPO_PUBLIC_FIREBASE_AUTH_EMULATOR_PORT,
        firestoreEmulatorPort: process.env.EXPO_PUBLIC_FIREBASE_FIRESTORE_EMULATOR_PORT,
        functionsEmulatorPort: process.env.EXPO_PUBLIC_FIREBASE_FUNCTIONS_EMULATOR_PORT,
      });
      if (__DEV__) {
        console.info('[firebase-runtime] initialized', JSON.stringify(firebaseRuntimeDiagnostics(runtime)));
        void probeFirebaseConnection(runtime).then((result) => {
          console.info('[firebase-runtime] connection', JSON.stringify(result));
        }).catch(() => {
          console.error('[firebase-runtime] connection probe failed');
        });
      }
    } catch (error) {
      const code = error instanceof FirebaseRuntimeConfigurationError ? error.code : 'initialization-failed';
      console.error('[firebase-runtime] configuration-error', code);
    }
  }, []);

  return (
    <Stack>
      <Stack.Screen name="index" options={{ headerShown: false }} />
    </Stack>
  );
}
