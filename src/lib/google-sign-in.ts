import {
  GoogleAuthProvider,
  type Auth,
  signInWithCredential,
  signInWithPopup,
  signInWithRedirect,
} from "firebase/auth";

import { googleAuthProvider } from "@/lib/google-auth";
import {
  canUseAuthRedirect,
  isInAppBrowser,
  isSafariOrIOS,
  shouldPreferGsiSignIn,
} from "@/lib/browser-auth";

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string;
            callback: (response: { credential: string }) => void;
            auto_select?: boolean;
            cancel_on_tap_outside?: boolean;
          }) => void;
          prompt: (
            momentListener?: (notification: {
              isNotDisplayed: () => boolean;
              isSkippedMoment: () => boolean;
              getNotDisplayedReason: () => string;
              getSkippedReason: () => string;
            }) => void,
          ) => void;
        };
      };
    };
  }
}

function loadGsiScript(): Promise<void> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("브라우저 환경이 아닙니다."));
  }
  if (window.google?.accounts?.id) return Promise.resolve();

  const existing = document.getElementById("google-gsi-client");
  if (existing) {
    return new Promise((resolve, reject) => {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener(
        "error",
        () => reject(new Error("Google 로그인 스크립트 로드 실패")),
        { once: true },
      );
    });
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.id = "google-gsi-client";
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () =>
      reject(new Error("Google 로그인 스크립트를 불러오지 못했습니다."));
    document.head.appendChild(script);
  });
}

async function signInWithGoogleGsi(auth: Auth, clientId: string): Promise<void> {
  await loadGsiScript();

  return new Promise((resolve, reject) => {
    let settled = false;
    const timerRef: { id?: ReturnType<typeof setTimeout> } = {};

    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      if (timerRef.id !== undefined) clearTimeout(timerRef.id);
      fn();
    };

    window.google!.accounts.id.initialize({
      client_id: clientId,
      auto_select: false,
      cancel_on_tap_outside: true,
      callback: (response) => {
        void (async () => {
          try {
            const credential = GoogleAuthProvider.credential(response.credential);
            if (!credential) {
              throw new Error("Google 인증 정보를 받지 못했습니다.");
            }
            await signInWithCredential(auth, credential);
            finish(() => resolve());
          } catch (err) {
            finish(() => reject(err));
          }
        })();
      },
    });

    window.google!.accounts.id.prompt((notification) => {
      if (notification.isNotDisplayed()) {
        const reason = notification.getNotDisplayedReason();
        finish(() =>
          reject(
            new Error(
              reason === "browser_not_supported" || reason === "suppressed_by_user"
                ? "Safari에서 Google 로그인을 표시할 수 없습니다. 팝업 차단을 해제하거나 Safari 설정 → 개인정보 보호에서 크로스 사이트 추적 방지를 끈 뒤 다시 시도해 주세요."
                : "Google 로그인 창을 열 수 없습니다. 잠시 후 다시 시도해 주세요.",
            ),
          ),
        );
      } else if (notification.isSkippedMoment()) {
        finish(() =>
          reject(
            new Error(
              "Google 로그인이 취소되었습니다. 다시 시도해 주세요.",
            ),
          ),
        );
      }
    });

    timerRef.id = setTimeout(() => {
      finish(() =>
        reject(
          new Error(
            "Google 로그인 응답이 없습니다. 팝업 차단을 확인한 뒤 다시 시도해 주세요.",
          ),
        ),
      );
    }, 120_000);
  });
}

/**
 * Safari/iOS·인앱 브라우저·호스팅 환경에 맞는 Google 로그인
 * - Firebase Hosting: redirect (sessionStorage 동일 출처)
 * - GitHub Pages 등: GSI credential (NEXT_PUBLIC_GOOGLE_CLIENT_ID) 또는 popup
 */
export async function signInWithGoogleForBrowser(auth: Auth): Promise<void> {
  const gsiClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID?.trim();

  if (shouldPreferGsiSignIn() && gsiClientId) {
    await signInWithGoogleGsi(auth, gsiClientId);
    return;
  }

  const useRedirect =
    (isSafariOrIOS() || isInAppBrowser()) && canUseAuthRedirect();

  if (useRedirect) {
    await signInWithRedirect(auth, googleAuthProvider);
    return;
  }

  try {
    await signInWithPopup(auth, googleAuthProvider);
  } catch (err) {
    const code =
      err && typeof err === "object" && "code" in err
        ? String((err as { code: string }).code)
        : "";

    if (code === "auth/popup-blocked" && canUseAuthRedirect()) {
      await signInWithRedirect(auth, googleAuthProvider);
      return;
    }

    if (
      (code === "auth/popup-blocked" || isSafariOrIOS()) &&
      gsiClientId
    ) {
      await signInWithGoogleGsi(auth, gsiClientId);
      return;
    }

    if (code === "auth/popup-blocked") {
      throw new Error(
        "팝업이 차단되었습니다. Safari 설정에서 팝업을 허용하거나, Chrome으로 접속해 주세요.",
      );
    }

    throw err;
  }
}
