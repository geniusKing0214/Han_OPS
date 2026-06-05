"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { useAuth } from "@/components/providers/auth-provider";
import { useNotifications } from "@/hooks/use-notifications";
import { withBasePath } from "@/lib/base-path";
import {
  isWebPushConfigured,
  isWebPushSupported,
  obtainFcmToken,
  showBrowserNotification,
  subscribeForegroundMessages,
} from "@/lib/firebase-messaging";
import { saveFcmToken } from "@/lib/firestore-users";

const PUSH_DISMISSED_KEY = "han-ops-push-banner-dismissed";

type WebPushContextValue = {
  supported: boolean;
  configured: boolean;
  permission: NotificationPermission;
  enabling: boolean;
  enabled: boolean;
  shouldShowBanner: boolean;
  enablePush: () => Promise<boolean>;
  dismissBanner: () => void;
};

const WebPushContext = createContext<WebPushContextValue | undefined>(undefined);

export function WebPushProvider({ children }: { children: ReactNode }) {
  const { user, canAccessApp } = useAuth();
  const { items } = useNotifications();
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [supported, setSupported] = useState(false);
  const [configured, setConfigured] = useState(false);
  const [enabling, setEnabling] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [bannerDismissed, setBannerDismissed] = useState(true);
  const seenNotificationIds = useRef<Set<string>>(new Set());
  const initializedSeen = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setPermission(Notification.permission);
    setConfigured(isWebPushConfigured());
    setBannerDismissed(localStorage.getItem(PUSH_DISMISSED_KEY) === "1");
    void isWebPushSupported().then(setSupported);
  }, []);

  const enablePush = useCallback(async () => {
    if (!user) return false;
    setEnabling(true);
    try {
      const token = await obtainFcmToken();
      if (!token) {
        setPermission(
          typeof Notification !== "undefined" ? Notification.permission : "denied",
        );
        return false;
      }
      await saveFcmToken(user.uid, token);
      setPermission("granted");
      setEnabled(true);
      localStorage.setItem(PUSH_DISMISSED_KEY, "1");
      setBannerDismissed(true);
      return true;
    } catch {
      return false;
    } finally {
      setEnabling(false);
    }
  }, [user]);

  useEffect(() => {
    if (!user || !canAccessApp || !configured || !supported) return;
    if (Notification.permission !== "granted") return;

    void (async () => {
      const token = await obtainFcmToken();
      if (!token) return;
      await saveFcmToken(user.uid, token);
      setEnabled(true);
    })();
  }, [user, canAccessApp, configured, supported]);

  useEffect(() => {
    if (!configured || !supported || Notification.permission !== "granted") return;

    const unsub = subscribeForegroundMessages((payload) => {
      const title = payload.notification?.title ?? "HAN OPS";
      const body = payload.notification?.body ?? "";
      const url = payload.data?.url
        ? withBasePath(String(payload.data.url))
        : withBasePath("/schedule");
      showBrowserNotification(title, { body, url });
    });

    return unsub;
  }, [configured, supported]);

  useEffect(() => {
    if (!canAccessApp || Notification.permission !== "granted") return;

    if (!initializedSeen.current) {
      for (const item of items) {
        seenNotificationIds.current.add(item.id);
      }
      initializedSeen.current = true;
      return;
    }

    for (const item of items) {
      if (item.isRead || seenNotificationIds.current.has(item.id)) continue;
      seenNotificationIds.current.add(item.id);
      const url =
        item.type === "schedule_created"
          ? withBasePath("/schedule")
          : withBasePath("/applications");
      showBrowserNotification(item.title, {
        body: item.message,
        url,
        tag: item.id,
      });
    }
  }, [items, canAccessApp]);

  const dismissBanner = useCallback(() => {
    localStorage.setItem(PUSH_DISMISSED_KEY, "1");
    setBannerDismissed(true);
  }, []);

  const shouldShowBanner =
    canAccessApp &&
    supported &&
    configured &&
    !bannerDismissed &&
    permission !== "granted" &&
    !enabled;

  const value: WebPushContextValue = {
    supported,
    configured,
    permission,
    enabling,
    enabled,
    shouldShowBanner,
    enablePush,
    dismissBanner,
  };

  return (
    <WebPushContext.Provider value={value}>{children}</WebPushContext.Provider>
  );
}

export function useWebPush() {
  const ctx = useContext(WebPushContext);
  if (!ctx) {
    throw new Error("useWebPush must be used within WebPushProvider");
  }
  return ctx;
}
