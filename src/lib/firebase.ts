import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

import {
  getEnvFirebaseConfig,
  getMissingFirebaseVars,
  resolveAuthDomain,
} from "@/lib/firebase-config";

function buildFirebaseConfig() {
  const cfg = getEnvFirebaseConfig();
  if (typeof window !== "undefined") {
    return { ...cfg, authDomain: resolveAuthDomain() };
  }
  return cfg;
}

export const firebaseConfigError =
  getMissingFirebaseVars().length > 0
    ? `Missing Firebase env vars: ${getMissingFirebaseVars().join(", ")}`
    : "";

export const isFirebaseConfigured = getMissingFirebaseVars().length === 0;

function initFirebaseApp(): FirebaseApp | null {
  if (!isFirebaseConfigured) return null;
  if (getApps().length > 0) return getApp();
  return initializeApp(buildFirebaseConfig());
}

export const app = initFirebaseApp();

export const db = app
  ? getFirestore(app)
  : (null as unknown as ReturnType<typeof getFirestore>);
