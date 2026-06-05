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

export function getVapidKey(): string {
  return process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY?.trim() ?? "";
}

export function isWebPushConfigured(): boolean {
  return getMissingFirebaseVars().length === 0 && getVapidKey().length > 0;
}

export async function isWebPushSupported(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  if (!hasNotificationApi() || !("serviceWorker" in navigator)) return false;
  try {
    return await isSupported();
  } catch {
    return false;
  }
}

async function getServiceWorkerRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return null;

  const swUrl = withBasePath("/firebase-messaging-sw.js");
  const scope = withBasePath("/");

  let registration = await navigator.serviceWorker.getRegistration(scope);
  if (!registration) {
    registration = await navigator.serviceWorker.register(swUrl, { scope });
  }
  await navigator.serviceWorker.ready;
  return registration;
}

/** PWA 백그라운드 푸시용 Service Worker 선등록 */
export async function registerMessagingServiceWorker(): Promise<void> {
  try {
    if (!(await isWebPushSupported())) return;
    await getServiceWorkerRegistration();
  } catch {
    // iOS Safari 등에서 SW 등록 실패해도 앱은 계속 동작
  }
}

export async function requestWebPushPermission(): Promise<NotificationPermission> {
  if (!hasNotificationApi()) return "denied";
  const current = getNotificationPermission();
  if (current === "granted" || current === "denied") return current;
  return Notification.requestPermission();
}

export async function obtainFcmToken(): Promise<string | null> {
  if (!(await isWebPushSupported()) || !isWebPushConfigured()) return null;

  const permission = await requestWebPushPermission();
  if (permission !== "granted") return null;

  const registration = await getServiceWorkerRegistration();
  if (!registration) return null;

  try {
    if (!messagingInstance) {
      messagingInstance = getMessaging(getMessagingApp());
    }

    const token = await getToken(messagingInstance, {
      vapidKey: getVapidKey(),
      serviceWorkerRegistration: registration,
    });

    return token || null;
  } catch {
    return null;
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
