import '../global.css';
import { Stack } from 'expo-router';
import React, { useEffect } from 'react';
import { Platform } from 'react-native';
import { firebaseRuntimeDiagnostics, getConfiguredFirebaseRuntime, probeFirebaseConnection } from '../features/auth/firebase-adapters';
import { FirebaseRuntimeConfigurationError } from '../features/auth/firebase-runtime-config';

export default function RootLayout() {
  useEffect(() => {
    if (Platform.OS === 'web') return;
    try {
      const runtime = getConfiguredFirebaseRuntime(Platform.OS, __DEV__);
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
