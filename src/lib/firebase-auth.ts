"use client";

import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import {
  browserLocalPersistence,
  browserPopupRedirectResolver,
  getAuth,
  getRedirectResult,
  indexedDBLocalPersistence,
  initializeAuth,
  type Auth,
} from "firebase/auth";

import { getEnvFirebaseConfig, resolveAuthDomain } from "@/lib/firebase-config";

let clientApp: FirebaseApp | null = null;
let clientAuth: Auth | null = null;

function getOrInitClientApp(): FirebaseApp {
  if (clientApp) return clientApp;
  const apps = getApps();
  if (apps.length > 0) {
    clientApp = getApp();
    return clientApp;
  }
  const cfg = getEnvFirebaseConfig();
  clientApp = initializeApp({
    ...cfg,
    authDomain: resolveAuthDomain(),
  });
  return clientApp;
}

/** Safari redirect 대응: indexedDB persistence + popup redirect resolver */
export function getClientAuth(): Auth {
  if (clientAuth) return clientAuth;

  const app = getOrInitClientApp();

  try {
    clientAuth = initializeAuth(app, {
      persistence: [indexedDBLocalPersistence, browserLocalPersistence],
      popupRedirectResolver: browserPopupRedirectResolver,
    });
  } catch {
    clientAuth = getAuth(app);
  }

  return clientAuth;
}

/** OAuth redirect 복귀 시 호출 (Safari missing initial state 방지) */
export async function consumeAuthRedirectResult(): Promise<void> {
  const auth = getClientAuth();
  try {
    await getRedirectResult(auth);
  } catch {
    // redirect 없음 또는 이미 처리됨
  }
}
