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
  registerMessagingServiceWorker,
  showBrowserNotification,
  subscribeForegroundMessages,
} from "@/lib/firebase-messaging";
import { saveFcmToken } from "@/lib/firestore-users";
import { getNotificationPermission } from "@/lib/notification-api";
import type { NotificationItem } from "@/types/notification";

const PUSH_DISMISSED_KEY = "han-ops-push-banner-dismissed";

function shouldPushNotify(item: NotificationItem, isAdmin: boolean): boolean {
  if (item.type === "schedule_created") return true;
  if (item.type === "application_submitted") return isAdmin;
  return false;
}

function openUrlForNotification(item: NotificationItem): string {
  if (item.type === "schedule_created") return withBasePath("/schedule");
  if (item.type === "application_submitted") return withBasePath("/admin/applications");
  return withBasePath("/dashboard");
}

type WebPushContextValue = {
  supported: boolean;
  configured: boolean;
  permission: NotificationPermission;
  enabling: boolean;
  enabled: boolean;
  pushError: string;
  shouldShowBanner: boolean;
  enablePush: () => Promise<boolean>;
  dismissBanner: () => void;
  clearPushError: () => void;
};

const WebPushContext = createContext<WebPushContextValue | undefined>(undefined);

export function WebPushProvider({ children }: { children: ReactNode }) {
  const { user, canAccessApp, isAdmin } = useAuth();
  const { items } = useNotifications();
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [supported, setSupported] = useState(false);
  const [configured, setConfigured] = useState(false);
  const [enabling, setEnabling] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [pushError, setPushError] = useState("");
  const [bannerDismissed, setBannerDismissed] = useState(true);
  const seenNotificationIds = useRef<Set<string>>(new Set());
  const initializedSeen = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setPermission(getNotificationPermission());
    setConfigured(isWebPushConfigured());
    setBannerDismissed(localStorage.getItem(PUSH_DISMISSED_KEY) === "1");
    void isWebPushSupported().then(setSupported);
  }, []);

  useEffect(() => {
    if (!canAccessApp) return;
    void isWebPushSupported().then((ok) => {
      if (ok) void registerMessagingServiceWorker();
    });
  }, [canAccessApp]);

  const clearPushError = useCallback(() => setPushError(""), []);

  const enablePush = useCallback(async () => {
    if (!user) {
      setPushError("로그인이 필요합니다.");
      return false;
    }

    setEnabling(true);
    setPushError("");

    try {
      const result = await obtainFcmToken();
      setPermission(result.permission);

      if (!result.ok) {
        setPushError(result.error);
        return false;
      }

      try {
        await saveFcmToken(user.uid, result.token);
      } catch (err) {
        setPushError(
          err instanceof Error
            ? `토큰 저장 실패: ${err.message}`
            : "Firestore에 토큰을 저장하지 못했습니다.",
        );
        return false;
      }

      setEnabled(true);
      localStorage.setItem(PUSH_DISMISSED_KEY, "1");
      setBannerDismissed(true);
      return true;
    } finally {
      setEnabling(false);
    }
  }, [user]);

  useEffect(() => {
    if (!user || !canAccessApp || !configured || !supported) return;
    if (getNotificationPermission() !== "granted") return;

    void (async () => {
      const result = await obtainFcmToken();
      setPermission(result.permission);
      if (!result.ok) return;
      try {
        await saveFcmToken(user.uid, result.token);
        setEnabled(true);
      } catch {
        // 자동 등록 실패 — 사용자가 수동 버튼으로 재시도
      }
    })();
  }, [user, canAccessApp, configured, supported]);

  useEffect(() => {
    if (!configured || !supported || getNotificationPermission() !== "granted") return;

    const unsub = subscribeForegroundMessages((payload) => {
      const type = payload.data?.type ?? "";
      if (type !== "schedule_created" && type !== "application_submitted") return;
      if (type === "application_submitted" && !isAdmin) return;

      const title = payload.notification?.title ?? "HAN OPS";
      const body = payload.notification?.body ?? "";
      const url = payload.data?.url
        ? String(payload.data.url)
        : type === "application_submitted"
          ? withBasePath("/admin/applications")
          : withBasePath("/schedule");
      showBrowserNotification(title, { body, url });
    });

    return unsub;
  }, [configured, supported, isAdmin]);

  useEffect(() => {
    if (!canAccessApp || getNotificationPermission() !== "granted") return;

    if (!initializedSeen.current) {
      for (const item of items) {
        seenNotificationIds.current.add(item.id);
      }
      initializedSeen.current = true;
      return;
    }

    for (const item of items) {
      if (item.isRead || seenNotificationIds.current.has(item.id)) continue;
      if (!shouldPushNotify(item, isAdmin)) continue;
      seenNotificationIds.current.add(item.id);
      showBrowserNotification(item.title, {
        body: item.message,
        url: openUrlForNotification(item),
        tag: item.id,
      });
    }
  }, [items, canAccessApp, isAdmin]);

  const dismissBanner = useCallback(() => {
    localStorage.setItem(PUSH_DISMISSED_KEY, "1");
    setBannerDismissed(true);
  }, []);

  const shouldShowBanner =
    canAccessApp &&
    supported &&
    configured &&
    !bannerDismissed &&
    !enabled &&
    permission !== "granted";

  const value: WebPushContextValue = {
    supported,
    configured,
    permission,
    enabling,
    enabled,
    pushError,
    shouldShowBanner,
    enablePush,
    dismissBanner,
    clearPushError,
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
