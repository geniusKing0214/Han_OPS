/** Firebase 웹 설정 (authDomain은 클라이언트에서 접속 호스트에 맞게 조정) */
export function getEnvFirebaseConfig() {
  return {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  };
}

export function resolveAuthDomain(): string {
  const envDomain =
    process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN?.trim() ?? "";
  if (typeof window === "undefined") return envDomain;

  const host = window.location.host;
  const envHost = envDomain.replace(/^https?:\/\//, "").split("/")[0];

  // Firebase Hosting / web.app — 앱과 auth helper가 같은 호스트여야 Safari redirect 동작
  if (
    host.endsWith(".firebaseapp.com") ||
    host.endsWith(".web.app")
  ) {
    return host;
  }

  // GitHub Pages 등 서브경로 호스팅 — env authDomain 유지 (팝업/GSI)
  return envHost || host;
}

export function getMissingFirebaseVars(): string[] {
  const cfg = getEnvFirebaseConfig();
  return Object.entries({
    NEXT_PUBLIC_FIREBASE_API_KEY: cfg.apiKey,
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: cfg.authDomain,
    NEXT_PUBLIC_FIREBASE_PROJECT_ID: cfg.projectId,
    NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: cfg.storageBucket,
    NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: cfg.messagingSenderId,
    NEXT_PUBLIC_FIREBASE_APP_ID: cfg.appId,
  })
    .filter(([, value]) => !value)
    .map(([key]) => key);
}
