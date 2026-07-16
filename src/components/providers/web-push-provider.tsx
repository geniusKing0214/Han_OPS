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
import { notificationHrefFor } from "@/lib/notification-navigation";
import {
  isWebPushConfigured,
  isWebPushSupported,
  obtainFcmToken,
  registerMessagingServiceWorker,
  showBrowserNotification,
  subscribeForegroundMessages,
} from "@/lib/firebase-messaging";
import { saveFcmToken, verifyFcmTokenSaved, getUserFcmTokens } from "@/lib/firestore-users";
import { getNotificationPermission } from "@/lib/notification-api";
import type { NotificationItem } from "@/types/notification";

const PUSH_DISMISSED_KEY = "han-ops-push-banner-dismissed";

function shouldPushNotify(item: NotificationItem, isAdmin: boolean): boolean {
  if (item.type === "schedule_created" || item.type === "schedule_cancelled") return !isAdmin;
  if (item.type === "application_submitted" || item.type === "application_cancelled") return isAdmin;
  if (item.type === "application_approved") return !isAdmin;
  if (item.type === "notice_posted") return true;
  if (item.type === "attendance_submitted") return isAdmin;
  if (item.type === "attendance_approved" || item.type === "attendance_rejected") {
    return !isAdmin;
  }
  if (
    item.type === "workforce_confirmed" ||
    item.type === "workforce_updated" ||
    item.type === "workforce_cancelled"
  ) {
    return !isAdmin;
  }
  return false;
}

function tokenPreview(token: string): string {
  return `${token.slice(0, 12)}…`;
}

export type EnablePushResult = {
  ok: boolean;
  message?: string;
  error?: string;
  tokenPreview?: string;
  verified?: boolean;
};

type WebPushContextValue = {
  supported: boolean;
  configured: boolean;
  permission: NotificationPermission;
  enabling: boolean;
  enabled: boolean;
  pushError: string;
  pushSuccessMessage: string;
  registeredTokenPreview: string;
  savedTokenCount: number;
  shouldShowBanner: boolean;
  enablePush: () => Promise<EnablePushResult>;
  refreshTokenStatus: () => Promise<void>;
  dismissBanner: () => void;
  clearPushError: () => void;
  clearPushSuccess: () => void;
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
  const [pushSuccessMessage, setPushSuccessMessage] = useState("");
  const [registeredTokenPreview, setRegisteredTokenPreview] = useState("");
  const [savedTokenCount, setSavedTokenCount] = useState(0);
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
  const clearPushSuccess = useCallback(() => setPushSuccessMessage(""), []);

  const refreshTokenStatus = useCallback(async () => {
    if (!user) {
      setSavedTokenCount(0);
      setRegisteredTokenPreview("");
      setEnabled(false);
      return;
    }
    const tokens = await getUserFcmTokens(user.uid);
    setSavedTokenCount(tokens.length);
    if (tokens.length > 0) {
      setRegisteredTokenPreview(tokenPreview(tokens[tokens.length - 1]!));
      setEnabled(true);
    }
  }, [user]);

  useEffect(() => {
    if (!user || !canAccessApp) return;
    void refreshTokenStatus();
  }, [user, canAccessApp, refreshTokenStatus]);

  const enablePush = useCallback(async (): Promise<EnablePushResult> => {
    if (!user) {
      const error = "로그인이 필요합니다.";
      setPushError(error);
      setPushSuccessMessage("");
      return { ok: false, error };
    }

    setEnabling(true);
    setPushError("");
    setPushSuccessMessage("");

    try {
      const result = await obtainFcmToken();
      setPermission(result.permission);

      if (!result.ok) {
        setPushError(result.error);
        return { ok: false, error: result.error };
      }

      const preview = tokenPreview(result.token);

      try {
        await saveFcmToken(user.uid, result.token);
      } catch (err) {
        const error =
          err instanceof Error
            ? `토큰 저장 실패: ${err.message}`
            : "Firestore에 토큰을 저장하지 못했습니다.";
        setPushError(error);
        return { ok: false, error };
      }

      let verified = false;
      try {
        verified = await verifyFcmTokenSaved(user.uid, result.token);
      } catch {
        verified = false;
      }

      if (!verified) {
        const error =
          "토큰은 발급됐지만 Firestore 저장 확인에 실패했습니다. 네트워크 확인 후 다시 시도하세요.";
        setPushError(error);
        return { ok: false, error, tokenPreview: preview };
      }

      const tokens = await getUserFcmTokens(user.uid);
      setSavedTokenCount(tokens.length);
      setRegisteredTokenPreview(preview);
      setEnabled(tokens.length > 0);

      const message = `푸시 등록이 완료되었습니다. (${preview})`;
      setPushSuccessMessage(message);
      localStorage.setItem(PUSH_DISMISSED_KEY, "1");
      setBannerDismissed(true);
      return { ok: true, message, tokenPreview: preview, verified: true };
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
    if (!user || !canAccessApp || !configured || !supported) return;

    const refreshToken = () => {
      if (document.visibilityState !== "visible") return;
      if (getNotificationPermission() !== "granted") return;
      void (async () => {
        const result = await obtainFcmToken();
        if (!result.ok) return;
        try {
          await saveFcmToken(user.uid, result.token);
          setEnabled(true);
        } catch {
          // 토큰 갱신 실패는 무시
        }
      })();
    };

    document.addEventListener("visibilitychange", refreshToken);
    window.addEventListener("focus", refreshToken);
    return () => {
      document.removeEventListener("visibilitychange", refreshToken);
      window.removeEventListener("focus", refreshToken);
    };
  }, [user, canAccessApp, configured, supported]);

  useEffect(() => {
    if (!configured || !supported || getNotificationPermission() !== "granted") return;

    const unsub = subscribeForegroundMessages((payload) => {
      const type = payload.data?.type ?? "";
      if (
        type !== "schedule_created" &&
        type !== "schedule_cancelled" &&
        type !== "application_submitted" &&
        type !== "application_cancelled" &&
        type !== "application_approved" &&
        type !== "notice_posted"
      ) {
        return;
      }
      if (
        (type === "application_submitted" || type === "application_cancelled") &&
        !isAdmin
      ) {
        return;
      }
      if (
        (type === "schedule_created" ||
          type === "schedule_cancelled" ||
          type === "application_approved") &&
        isAdmin
      ) {
        return;
      }

      const title = payload.notification?.title ?? "HAN OPS";
      const body = payload.notification?.body ?? "";
      const url = payload.data?.url
        ? String(payload.data.url)
        : notificationHrefFor({
            id: "",
            targetUserId: "",
            targetRole: "admin",
            type: type as NotificationItem["type"],
            title: "",
            message: "",
            eventTitle: "",
            eventDate: String(payload.data?.eventDate ?? ""),
            slotTime: String(payload.data?.slotTime ?? ""),
            location: "",
            isRead: false,
            createdAt: "",
            eventId: payload.data?.eventId
              ? String(payload.data.eventId)
              : undefined,
            applicationId: payload.data?.applicationId
              ? String(payload.data.applicationId)
              : undefined,
          });
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
        url: notificationHrefFor(item),
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
    pushSuccessMessage,
    registeredTokenPreview,
    savedTokenCount,
    shouldShowBanner,
    enablePush,
    refreshTokenStatus,
    dismissBanner,
    clearPushError,
    clearPushSuccess,
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
