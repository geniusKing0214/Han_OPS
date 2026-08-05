"use client";

import { useCallback, useEffect, useState } from "react";
import { BellRing, CheckCircle2, Send, XCircle } from "lucide-react";

import { useAuth } from "@/components/providers/auth-provider";
import { useWebPush } from "@/components/providers/web-push-provider";
import { withBasePath } from "@/lib/base-path";
import {
  isWebPushConfigured,
  isWebPushSupported,
  isVapidKeyValid,
  registerMessagingServiceWorker,
  validateVapidPublicKey,
  getVapidKey,
} from "@/lib/firebase-messaging";
import { getNotificationPermission } from "@/lib/notification-api";
import {
  isStandalonePwa,
  needsPwaInstallForBackgroundPush,
} from "@/lib/pwa-utils";
import { isPushRelayConfigured, sendTestPushToSelf } from "@/lib/push-relay";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type CheckState = "ok" | "warn" | "fail" | "pending";

function StatusRow({
  label,
  state,
  detail,
}: {
  label: string;
  state: CheckState;
  detail: string;
}) {
  const Icon =
    state === "ok"
      ? CheckCircle2
      : state === "fail"
        ? XCircle
        : CheckCircle2;
  const color =
    state === "ok"
      ? "text-emerald-600"
      : state === "fail"
        ? "text-red-600"
        : "text-amber-600";

  return (
    <div className="flex gap-2 rounded-md border border-border/80 bg-muted/20 px-3 py-2 text-sm">
      <Icon className={`mt-0.5 size-4 shrink-0 ${color}`} aria-hidden />
      <div className="min-w-0">
        <p className="font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">{detail}</p>
      </div>
    </div>
  );
}

export function PushNotificationSettings() {
  const { user } = useAuth();
  const {
    enabling,
    enabled,
    enablePush,
    pushError,
    pushSuccessMessage,
    registeredTokenPreview,
    savedTokenCount,
    refreshTokenStatus,
    clearPushSuccess,
  } = useWebPush();
  const [checking, setChecking] = useState(true);
  const [swOk, setSwOk] = useState(false);
  const [localError, setLocalError] = useState("");
  const [testingPush, setTestingPush] = useState(false);
  const [testPushResult, setTestPushResult] = useState("");

  const runChecks = useCallback(async () => {
    setChecking(true);
    setLocalError("");
    try {
      const supported = await isWebPushSupported();
      if (!supported) {
        setSwOk(false);
        return;
      }
      await registerMessagingServiceWorker();
      const scope = withBasePath("/").replace(/\/?$/, "/");
      const reg = await navigator.serviceWorker.getRegistration(scope);
      setSwOk(Boolean(reg?.active?.scriptURL?.includes("firebase-messaging-sw.js")));
      await refreshTokenStatus();
    } catch (err) {
      setSwOk(false);
      setLocalError(err instanceof Error ? err.message : "진단 실패");
    } finally {
      setChecking(false);
    }
  }, [refreshTokenStatus]);

  useEffect(() => {
    void runChecks();
  }, [runChecks]);

  const handleEnable = async () => {
    setLocalError("");
    clearPushSuccess();
    const result = await enablePush();
    if (!result.ok && result.error) {
      setLocalError(result.error);
    }
    await refreshTokenStatus();
    await runChecks();
  };

  const handleTestPush = async () => {
    if (!user) {
      setTestPushResult("로그인이 필요합니다.");
      return;
    }
    setTestingPush(true);
    setTestPushResult("");
    try {
      const result = await sendTestPushToSelf(user.uid);
      if (result.sent && result.sent > 0) {
        setTestPushResult(
          `테스트 푸시 발송 성공 (${result.sent}/${result.total ?? result.sent}대). 앱을 완전히 종료한 뒤 10초 안에 알림이 오는지 확인하세요.`,
        );
      } else if (result.reason === "no_tokens") {
        setTestPushResult(
          "Firestore에 FCM 토큰이 없습니다. VAPID 키 변경 후 「푸시 등록 / 다시 등록」을 먼저 눌러주세요.",
        );
      } else if (result.errors?.length) {
        setTestPushResult(
          `FCM 발송 실패: ${result.errors[0]} — 「푸시 등록 / 다시 등록」 후 재시도하세요.`,
        );
      } else {
        setTestPushResult(
          result.error ?? "푸시 발송에 실패했습니다. 잠시 후 다시 시도하세요.",
        );
      }
    } catch (err) {
      setTestPushResult(
        err instanceof Error ? err.message : "테스트 푸시 요청에 실패했습니다.",
      );
    } finally {
      setTestingPush(false);
    }
  };

  const permission = getNotificationPermission();
  const configured = isWebPushConfigured();
  const vapidValidation = validateVapidPublicKey(getVapidKey());
  const vapidPresent = getVapidKey().length > 0;
  const relayConfigured = isPushRelayConfigured();
  const needsPwa = needsPwaInstallForBackgroundPush();
  const standalone = isStandalonePwa();
  const hasSavedToken = enabled || savedTokenCount > 0 || Boolean(registeredTokenPreview);
  const displayError = localError || pushError;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">푸시 알림 (백그라운드)</CardTitle>
        <CardDescription>
          앱을 닫아도 알림을 받으려면 아래 항목이 모두 필요합니다. VAPID 키를
          바꾼 뒤에는 반드시 「푸시 등록」을 다시 눌러주세요.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <StatusRow
          label="1. VAPID 키 (빌드)"
          state={configured ? "ok" : vapidPresent && !isVapidKeyValid() ? "fail" : "fail"}
          detail={
            configured
              ? `앱 빌드에 유효한 VAPID가 포함되어 있습니다. (${vapidValidation.charLength ?? 0}자)`
              : vapidPresent && !vapidValidation.ok
                ? vapidValidation.error ?? "VAPID 키 형식 오류"
                : "GitHub Secret NEXT_PUBLIC_FIREBASE_VAPID_KEY 확인 후 재배포"
          }
        />
        <StatusRow
          label="2. PWA 설치 (iPhone 필수)"
          state={needsPwa ? "warn" : standalone ? "ok" : "warn"}
          detail={
            needsPwa
              ? "Safari → 공유 → 홈 화면에 추가 후 앱 아이콘으로 실행"
              : standalone
                ? "홈 화면/앱으로 실행 중"
                : "브라우저 탭보다 앱 설치를 권장합니다"
          }
        />
        <StatusRow
          label="3. 알림 권한"
          state={
            permission === "granted" ? "ok" : permission === "denied" ? "fail" : "warn"
          }
          detail={
            permission === "granted"
              ? "허용됨"
              : permission === "denied"
                ? "차단됨 — 브라우저/기기 설정에서 허용"
                : "아직 허용하지 않음"
          }
        />
        <StatusRow
          label="4. Service Worker"
          state={checking ? "pending" : swOk ? "ok" : "fail"}
          detail={
            checking
              ? "확인 중…"
              : swOk
                ? "등록됨 — FCM 수신 준비 OK"
                : "등록 실패 — 페이지 새로고침 후 재시도"
          }
        />
        <StatusRow
          label="5. 푸시 릴레이 (Cloudflare Worker · 무료)"
          state={relayConfigured ? "ok" : "fail"}
          detail={
            relayConfigured
              ? "백그라운드 OS 푸시 릴레이 URL이 설정되어 있습니다."
              : "NEXT_PUBLIC_PUSH_RELAY_URL + NEXT_PUBLIC_PUSH_API_SECRET 설정 및 Worker 배포 필요 (Blaze 불필요)"
          }
        />
        <StatusRow
          label="6. FCM 토큰 (Firestore)"
          state={hasSavedToken ? "ok" : "warn"}
          detail={
            hasSavedToken
              ? `등록됨 ${registeredTokenPreview ? `(${registeredTokenPreview})` : ""} — 저장된 기기 ${savedTokenCount || 1}대`
              : "아래 「푸시 등록」을 눌러 토큰을 저장하세요"
          }
        />

        {pushSuccessMessage ? (
          <p className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-200">
            ✅ {pushSuccessMessage}
            <span className="mt-1 block text-emerald-700/80">
              Firestore 저장까지 확인되었습니다. 이 기기에서 백그라운드 푸시를 받을 수 있습니다.
            </span>
          </p>
        ) : null}

        {displayError ? (
          <p className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-700">
            ❌ {displayError}
          </p>
        ) : null}

        {testPushResult ? (
          <p
            className={`rounded-md border px-3 py-2 text-xs ${
              testPushResult.includes("성공")
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
                : "border-amber-500/30 bg-amber-500/10 text-amber-200"
            }`}
          >
            {testPushResult}
          </p>
        ) : null}

        <div className="flex flex-wrap gap-2 pt-1">
          <Button
            type="button"
            size="sm"
            variant="accent"
            className="gap-1.5"
            disabled={enabling || !configured}
            onClick={() => void handleEnable()}
          >
            <BellRing className="size-3.5" />
            {enabling ? "등록 중…" : "푸시 등록 / 다시 등록"}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="gap-1.5"
            disabled={testingPush || !relayConfigured || !hasSavedToken || !user}
            onClick={() => void handleTestPush()}
          >
            <Send className="size-3.5" />
            {testingPush ? "발송 중…" : "테스트 푸시 보내기"}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => void runChecks()}
          >
            상태 새로고침
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
