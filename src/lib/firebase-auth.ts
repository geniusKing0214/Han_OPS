"use client";

import {
  browserLocalPersistence,
  browserPopupRedirectResolver,
  getAuth,
  getRedirectResult,
  indexedDBLocalPersistence,
  initializeAuth,
  onAuthStateChanged,
  setPersistence,
  type Auth,
} from "firebase/auth";

import { app, isFirebaseConfigured } from "@/lib/firebase";

let clientAuth: Auth | null = null;
let persistencePromise: Promise<void> | null = null;

function initClientAuth(): Auth {
  if (clientAuth) return clientAuth;
  if (!app) {
    throw new Error("Firebase is not configured.");
  }

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

/** IndexedDB/localStorage에서 세션 복원이 끝날 때까지 대기 */
function waitForInitialAuthState(auth: Auth): Promise<void> {
  return new Promise((resolve) => {
    const unsub = onAuthStateChanged(auth, () => {
      unsub();
      resolve();
    });
  });
}
/** IndexedDB → localStorage 순으로 영구 로그인 유지 */
export async function ensureAuthPersistence(auth: Auth): Promise<void> {
  if (persistencePromise) {
    await persistencePromise;
    return;
  }

  persistencePromise = (async () => {
    try {
      await setPersistence(auth, indexedDBLocalPersistence);
      return;
    } catch {
      // initializeAuth에서 이미 설정됐거나 IndexedDB 불가
    }
    try {
      await setPersistence(auth, browserLocalPersistence);
    } catch {
      // 브라우저 기본 persistence 사용
    }
  })();

  await persistencePromise;
}

export function getClientAuth(): Auth {
  if (!isFirebaseConfigured) {
    throw new Error("Firebase is not configured.");
  }
  return initClientAuth();
}

/** persistence 복원·redirect 처리까지 완료된 Auth */
export async function getClientAuthReady(): Promise<Auth> {
  const auth = getClientAuth();
  await ensureAuthPersistence(auth);
  await consumeAuthRedirectResult();
  await waitForInitialAuthState(auth);
  return auth;
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
