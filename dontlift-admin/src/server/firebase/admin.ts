import "server-only";

import { applicationDefault, getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import { getFirebaseRuntimeConfig } from "@/lib/firebase/config";

let app: App | null = null;

export function getAdminApp(): App {
  const config = getFirebaseRuntimeConfig();
  if (app) {
    if (app.options.projectId !== config.projectId) {
      throw new Error("Firebase Admin was already initialized for a different project.");
    }
    return app;
  }

  const existing = getApps().find((candidate) => candidate.name === "dontlift-admin");
  if (existing) {
    if (existing.options.projectId !== config.projectId) {
      throw new Error("Existing Firebase Admin app project does not match configuration.");
    }
    app = existing;
    return app;
  }

  app = initializeApp(
    {
      projectId: config.projectId,
      ...(config.mode === "cloud" ? { credential: applicationDefault() } : {}),
    },
    "dontlift-admin",
  );
  return app;
}

export function getAdminAuth(): Auth {
  return getAuth(getAdminApp());
}

export function getAdminFirestore(): Firestore {
  return getFirestore(getAdminApp());
}
