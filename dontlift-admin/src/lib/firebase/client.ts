"use client";

import {
  browserSessionPersistence,
  connectAuthEmulator,
  initializeAuth,
  setPersistence,
  type Auth,
} from "firebase/auth";
import { getApp, getApps, initializeApp } from "firebase/app";
import { getFirebaseWebConfig } from "./config";

let auth: Auth | null = null;
let persistenceReady: Promise<Auth> | null = null;

export function getBrowserAuth(): Auth {
  if (typeof window === "undefined") {
    throw new Error("Firebase browser Auth is only available in the browser.");
  }

  if (auth) return auth;
  const config = getFirebaseWebConfig();
  const app = getApps().some((candidate) => candidate.name === "[DEFAULT]")
    ? getApp()
    : initializeApp({
        apiKey: config.apiKey,
        authDomain: config.authDomain,
        projectId: config.projectId,
        appId: config.appId,
      });

  auth = initializeAuth(app, { persistence: browserSessionPersistence });
  if (config.authEmulatorUrl) {
    connectAuthEmulator(auth, config.authEmulatorUrl, { disableWarnings: true });
  }
  return auth;
}

export function ensureTabSessionPersistence(): Promise<Auth> {
  if (persistenceReady) return persistenceReady;
  const pending = setPersistence(getBrowserAuth(), browserSessionPersistence)
    .then(() => getBrowserAuth())
    .catch((error: unknown) => {
      persistenceReady = null;
      throw error;
    });
  persistenceReady = pending;
  return pending;
}
