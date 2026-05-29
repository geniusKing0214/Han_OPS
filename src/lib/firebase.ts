import { getApp, getApps, initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

import {
  getEnvFirebaseConfig,
  getMissingFirebaseVars,
} from "@/lib/firebase-config";

const firebaseConfig = getEnvFirebaseConfig();

export const firebaseConfigError =
  getMissingFirebaseVars().length > 0
    ? `Missing Firebase env vars: ${getMissingFirebaseVars().join(", ")}`
    : "";

export const isFirebaseConfigured = getMissingFirebaseVars().length === 0;

const app = isFirebaseConfigured
  ? getApps().length
    ? getApp()
    : initializeApp(firebaseConfig)
  : null;

export const db = app
  ? getFirestore(app)
  : (null as unknown as ReturnType<typeof getFirestore>);
