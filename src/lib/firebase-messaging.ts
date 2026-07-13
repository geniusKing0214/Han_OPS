import { FirebaseError } from "firebase/app";
import { getApp, getApps, initializeApp } from "firebase/app";
import {
  getMessaging,
  getToken,
  isSupported,
  onMessage,
  type MessagePayload,
  type Messaging,
} from "firebase/messaging";

import { withBasePath } from "@/lib/base-path";
import {
  getNotificationPermission,
  hasNotificationApi,
} from "@/lib/notification-api";
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

function getMessagingApp() {
  if (getApps().length > 0) return getApp();
  return initializeApp(buildFirebaseConfig());
}

let messagingInstance: Messaging | null = null;

/** Firebase Web Push 공개키(VAPID) 정규화 */
export function normalizeVapidKey(raw: string): string {
  return raw.trim().replace(/^["']|["']$/g, "");
}

function decodeVapidPublicKey(key: string): Uint8Array | null {
  try {
    const normalized = normalizeVapidKey(key);
    if (!normalized || !/^[A-Za-z0-9_-]+$/.test(normalized)) return null;
    const pad = "=".repeat((4 - (normalized.length % 4)) % 4);
    const b64 = normalized.replace(/-/g, "+").replace(/_/g, "/") + pad;
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  } catch {
    return null;
  }
}

export type VapidKeyValidation = {
  ok: boolean;
  error?: string;
  charLength?: number;
  byteLength?: number;
};

/** P-256 공개키(65바이트, 0x04…) 여부 확인 */
export function validateVapidPublicKey(raw: string): VapidKeyValidation {
  const key = normalizeVapidKey(raw);
  if (!key) {
    return { ok: false, error: "VAPID 키가 비어 있습니다." };
  }
  if (!/^[A-Za-z0-9_-]+$/.test(key)) {
    return {
      ok: false,
      charLength: key.length,
      error:
        "VAPID 키에 공백·따옴표 등 잘못된 문자가 있습니다. Firebase에서 키만 다시 복사하세요.",
    };
  }

  const decoded = decodeVapidPublicKey(key);
  if (!decoded) {
    return {
      ok: false,
      charLength: key.length,
      error: "VAPID 키를 해석할 수 없습니다. Firebase Web Push 공개키를 사용하세요.",
    };
  }

  if (decoded.length !== 65 || decoded[0] !== 0x04) {
    return {
      ok: false,
      charLength: key.length,
      byteLength: decoded.length,
      error: `VAPID 키가 올바른 P-256 공개키가 아닙니다 (${key.length}자, ${decoded.length}바이트). Firebase Console → Cloud Messaging → 웹 푸시 인증서에서 키 **전체**(보통 87~88자)를 복사하거나 새 키 쌍을 생성하세요.`,
    };
  }

  return { ok: true, charLength: key.length, byteLength: decoded.length };
}

export function getVapidKey(): string {
  return normalizeVapidKey(process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY ?? "");
}

export function isVapidKeyValid(): boolean {
  return validateVapidPublicKey(getVapidKey()).ok;
}

export function isWebPushConfigured(): boolean {
  return getMissingFirebaseVars().length === 0 && isVapidKeyValid();
}

export async function isWebPushSupported(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  if (!("serviceWorker" in navigator)) return false;
  try {
    return await isSupported();
  } catch {
    return false;
  }
}

/** GitHub Pages 서브경로용 SW scope (/Han_OPS/) */
function serviceWorkerScope(): string {
  const scope = withBasePath("/");
  return scope.endsWith("/") ? scope : `${scope}/`;
}

function serviceWorkerScriptUrl(): string {
  return withBasePath("/firebase-messaging-sw.js");
}

function formatPushError(error: unknown): string {
  if (error instanceof FirebaseError) {
    if (error.code === "messaging/permission-blocked") {
      return "알림 권한이 차단되어 있습니다. 브라우저/기기 설정에서 허용해 주세요.";
    }
    if (
      error.code === "messaging/invalid-vapid-key" ||
      error.code === "messaging/vapid-key-required"
    ) {
      return "VAPID 키가 올바르지 않습니다. Firebase Console Web Push 키와 GitHub Secret을 확인하세요.";
    }
    if (error.code === "messaging/failed-service-worker-registration") {
      return "Service Worker 등록에 실패했습니다. 페이지를 새로고침한 뒤 다시 시도하세요.";
    }
    return error.message || error.code;
  }
  if (error instanceof Error) {
    const msg = error.message;
    if (/applicationServerKey|valid P-256 public Key/i.test(msg)) {
      const vapid = validateVapidPublicKey(getVapidKey());
      return (
        vapid.error ??
        "VAPID 공개키가 올바르지 않습니다. Firebase에서 키 전체를 다시 복사한 뒤 GitHub Secret을 갱신하고 재배포하세요."
      );
    }
    return msg;
  }
  return "푸시 토큰을 받지 못했습니다.";
}

function registrationScriptUrl(reg: ServiceWorkerRegistration): string {
  return (
    reg.active?.scriptURL ??
    reg.installing?.scriptURL ??
    reg.waiting?.scriptURL ??
    ""
  );
}

function normalizeScopePath(scopeUrl: string): string {
  try {
    const path = new URL(scopeUrl).pathname.replace(/\/$/, "");
    return path || "/";
  } catch {
    return scopeUrl.replace(/\/$/, "");
  }
}

async function getServiceWorkerRegistration(): Promise<ServiceWorkerRegistration> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
    throw new Error("이 브라우저는 Service Worker를 지원하지 않습니다.");
  }

  const swUrl = serviceWorkerScriptUrl();
  const scope = serviceWorkerScope();
  const expectedScript = new URL(swUrl, window.location.origin).href;
  const expectedScope = normalizeScopePath(scope);

  const all = await navigator.serviceWorker.getRegistrations();
  for (const reg of all) {
    const script = registrationScriptUrl(reg);
    if (!script.includes("firebase-messaging-sw.js")) continue;

    const sameScript = script === expectedScript;
    const sameScope = normalizeScopePath(reg.scope) === expectedScope;
    if (!sameScript || !sameScope) {
      await reg.unregister();
    }
  }

  let registration = await navigator.serviceWorker.getRegistration(scope);
  const scriptOk = (reg: ServiceWorkerRegistration | undefined) =>
    Boolean(reg && registrationScriptUrl(reg).includes("firebase-messaging-sw.js"));

  if (!scriptOk(registration)) {
    registration = await navigator.serviceWorker.register(swUrl, { scope });
  }

  if (!registration) {
    throw new Error("Service Worker를 등록하지 못했습니다.");
  }

  await navigator.serviceWorker.ready;

  if (!registration.active) {
    throw new Error("Service Worker가 활성화되지 않았습니다. 잠시 후 다시 시도하세요.");
  }

  return registration;
}

/** PWA 백그라운드 푸시용 Service Worker 선등록 */
export async function registerMessagingServiceWorker(): Promise<void> {
  try {
    if (!(await isWebPushSupported())) return;
    await getServiceWorkerRegistration();
  } catch {
    // 선등록 실패는 enable 단계에서 다시 시도
  }
}

export async function requestWebPushPermission(): Promise<NotificationPermission> {
  if (!hasNotificationApi()) {
    throw new Error(
      "이 환경에서는 웹 푸시를 지원하지 않습니다. iPhone은 홈 화면에 추가한 뒤 앱으로 실행하세요.",
    );
  }
  const current = getNotificationPermission();
  if (current === "granted") return "granted";
  if (current === "denied") return "denied";
  return Notification.requestPermission();
}

export type ObtainFcmTokenResult =
  | { ok: true; token: string; permission: NotificationPermission }
  | { ok: false; error: string; permission: NotificationPermission };

export async function obtainFcmToken(): Promise<ObtainFcmTokenResult> {
  if (!(await isWebPushSupported())) {
    return {
      ok: false,
      error:
        "이 브라우저/환경에서는 FCM 푸시를 지원하지 않습니다. iPhone은 PWA(홈 화면 추가)로 실행하세요.",
      permission: getNotificationPermission(),
    };
  }

  if (!isWebPushConfigured()) {
    const vapid = validateVapidPublicKey(getVapidKey());
    if (getVapidKey() && !vapid.ok) {
      return {
        ok: false,
        error: vapid.error ?? "VAPID 키가 올바르지 않습니다.",
        permission: getNotificationPermission(),
      };
    }
    return {
      ok: false,
      error: "VAPID 키(NEXT_PUBLIC_FIREBASE_VAPID_KEY)가 설정되지 않았습니다.",
      permission: getNotificationPermission(),
    };
  }

  let permission: NotificationPermission;
  try {
    permission = await requestWebPushPermission();
  } catch (err) {
    return {
      ok: false,
      error: formatPushError(err),
      permission: getNotificationPermission(),
    };
  }

  if (permission !== "granted") {
    return {
      ok: false,
      error:
        permission === "denied"
          ? "알림 권한이 거부되었습니다."
          : "알림 권한이 필요합니다.",
      permission,
    };
  }

  try {
    const registration = await getServiceWorkerRegistration();

    if (!messagingInstance) {
      messagingInstance = getMessaging(getMessagingApp());
    }

    const token = await getToken(messagingInstance, {
      vapidKey: getVapidKey(),
      serviceWorkerRegistration: registration,
    });

    if (!token) {
      return {
        ok: false,
        error: "FCM 토큰을 받지 못했습니다. VAPID 키와 Service Worker를 확인하세요.",
        permission,
      };
    }

    return { ok: true, token, permission };
  } catch (err) {
    return {
      ok: false,
      error: formatPushError(err),
      permission: getNotificationPermission(),
    };
  }
}

export function subscribeForegroundMessages(
  handler: (payload: MessagePayload) => void,
): () => void {
  try {
    if (!messagingInstance) {
      messagingInstance = getMessaging(getMessagingApp());
    }
    return onMessage(messagingInstance, handler);
  } catch {
    return () => {};
  }
}

export function showBrowserNotification(
  title: string,
  options?: NotificationOptions & { url?: string },
) {
  if (!hasNotificationApi() || getNotificationPermission() !== "granted") {
    return;
  }

  const { url, ...rest } = options ?? {};
  try {
    const notification = new Notification(title, {
      icon: withBasePath("/icons/icon-192.png"),
      badge: withBasePath("/icons/icon-192.png"),
      ...rest,
    });

    if (url) {
      notification.onclick = () => {
        window.focus();
        window.location.href = url;
        notification.close();
      };
    }
  } catch {
    // iOS 등에서 Notification 생성 실패 시 무시
  }
}
