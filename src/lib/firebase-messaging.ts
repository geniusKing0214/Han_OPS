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
  if (!("Notification" in window) || !("serviceWorker" in navigator)) return false;
  try {
    return await isSupported();
  } catch {
    return false;
  }
}

async function getServiceWorkerRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return null;

  const swUrl = withBasePath("/firebase-messaging-sw.js");
  const existing = await navigator.serviceWorker.getRegistration(swUrl);
  if (existing) return existing;

  return navigator.serviceWorker.register(swUrl, {
    scope: withBasePath("/"),
  });
}

export async function requestWebPushPermission(): Promise<NotificationPermission> {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return "denied";
  }
  if (Notification.permission === "granted") return "granted";
  if (Notification.permission === "denied") return "denied";
  return Notification.requestPermission();
}

export async function obtainFcmToken(): Promise<string | null> {
  if (!(await isWebPushSupported()) || !isWebPushConfigured()) return null;

  const permission = await requestWebPushPermission();
  if (permission !== "granted") return null;

  const registration = await getServiceWorkerRegistration();
  if (!registration) return null;

  if (!messagingInstance) {
    messagingInstance = getMessaging(getMessagingApp());
  }

  const token = await getToken(messagingInstance, {
    vapidKey: getVapidKey(),
    serviceWorkerRegistration: registration,
  });

  return token || null;
}

export function subscribeForegroundMessages(
  handler: (payload: MessagePayload) => void,
): () => void {
  if (!messagingInstance) {
    messagingInstance = getMessaging(getMessagingApp());
  }
  return onMessage(messagingInstance, handler);
}

export function showBrowserNotification(
  title: string,
  options?: NotificationOptions & { url?: string },
) {
  if (typeof window === "undefined" || Notification.permission !== "granted") {
    return;
  }

  const { url, ...rest } = options ?? {};
  const notification = new Notification(title, {
    icon: withBasePath("/icons/icon-192.svg"),
    badge: withBasePath("/icons/icon-192.svg"),
    ...rest,
  });

  if (url) {
    notification.onclick = () => {
      window.focus();
      window.location.href = url;
      notification.close();
    };
  }
}
