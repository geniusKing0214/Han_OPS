"use client";

import { useEffect, useState } from "react";
import { BellRing, Download, Share, Smartphone, X } from "lucide-react";

import { useWebPush } from "@/components/providers/web-push-provider";
import { Button } from "@/components/ui/button";
import {
  isAndroidDevice,
  isIosDevice,
  isStandalonePwa,
  needsPwaInstallForBackgroundPush,
} from "@/lib/pwa-utils";

const PWA_BANNER_DISMISSED_KEY = "han-ops-pwa-banner-dismissed";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export function PwaSetupBanner() {
  const {
    supported,
    configured,
    permission,
    enabling,
    enabled,
    enablePush,
    shouldShowBanner: shouldShowPushBanner,
  } = useWebPush();

  const [dismissed, setDismissed] = useState(true);
  const [standalone, setStandalone] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(
    null,
  );
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    setDismissed(localStorage.getItem(PWA_BANNER_DISMISSED_KEY) === "1");
    setStandalone(isStandalonePwa());

    const onInstall = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onInstall);
    return () => window.removeEventListener("beforeinstallprompt", onInstall);
  }, []);

  const dismiss = () => {
    localStorage.setItem(PWA_BANNER_DISMISSED_KEY, "1");
    setDismissed(true);
  };

  const handleAndroidInstall = async () => {
    if (!installPrompt) return;
    setInstalling(true);
    try {
      await installPrompt.prompt();
      await installPrompt.userChoice;
      setInstallPrompt(null);
      setStandalone(isStandalonePwa());
      if (configured && supported) {
        void enablePush();
      }
    } finally {
      setInstalling(false);
    }
  };

  const needsIosInstall = needsPwaInstallForBackgroundPush();
  const pushReady = permission === "granted" && enabled;
  const showPushStep =
    supported &&
    configured &&
    !pushReady &&
    (shouldShowPushBanner || permission === "default") &&
    !needsIosInstall;

  const showBanner =
    !dismissed &&
    supported &&
    (needsIosInstall || installPrompt !== null || showPushStep || !configured);

  if (!showBanner) return null;

  return (
    <div className="mb-4 flex items-start gap-3 rounded-xl border border-accent/25 bg-gradient-to-br from-accent/10 to-muted/30 px-4 py-4 shadow-sm">
      <Smartphone className="mt-0.5 size-5 shrink-0 text-accent" aria-hidden />
      <div className="min-w-0 flex-1 space-y-3">
        <div>
          <p className="text-sm font-semibold">앱처럼 설치 · 백그라운드 알림</p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            카카오톡·인스타처럼 앱을 닫아도 새 스케줄·신청 알림을 받으려면{" "}
            <strong className="font-medium text-foreground">홈 화면에 추가</strong>
            한 뒤 <strong className="font-medium text-foreground">알림 허용</strong>
            이 필요합니다.
          </p>
        </div>

        {needsIosInstall ? (
          <div className="rounded-lg border border-border/80 bg-background/50 px-3 py-2.5 text-xs text-muted-foreground">
            <p className="flex items-center gap-1.5 font-medium text-foreground">
              <Share className="size-3.5 shrink-0" />
              iPhone / iPad
            </p>
            <ol className="mt-2 list-decimal space-y-1 pl-4">
              <li>Safari 하단 <strong>공유</strong> 버튼 탭</li>
              <li>
                <strong>홈 화면에 추가</strong> 선택
              </li>
              <li>홈 화면의 <strong>HAN OPS</strong> 아이콘으로 실행</li>
              <li>앱 안에서 <strong>알림 허용</strong></li>
            </ol>
          </div>
        ) : null}

        {!needsIosInstall && installPrompt ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="gap-1.5"
            disabled={installing}
            onClick={() => void handleAndroidInstall()}
          >
            <Download className="size-3.5" />
            {installing ? "설치 중..." : "앱 설치 (홈 화면 추가)"}
          </Button>
        ) : null}

        {!needsIosInstall && isAndroidDevice() && !installPrompt && !standalone ? (
          <p className="text-xs text-muted-foreground">
            Chrome 메뉴(⋮) → <strong>앱 설치</strong> 또는{" "}
            <strong>홈 화면에 추가</strong>로 설치할 수 있습니다.
          </p>
        ) : null}

        {!configured ? (
          <p className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-800">
            Firebase Console에서 VAPID 키를 발급한 뒤{" "}
            <code className="text-[11px]">NEXT_PUBLIC_FIREBASE_VAPID_KEY</code>를
            설정하세요.
          </p>
        ) : null}

        {showPushStep ? (
          <Button
            type="button"
            size="sm"
            variant="accent"
            className="gap-1.5"
            disabled={enabling}
            onClick={() => void enablePush()}
          >
            <BellRing className="size-3.5" />
            {enabling ? "설정 중..." : "푸시 알림 허용"}
          </Button>
        ) : null}

        {pushReady && standalone ? (
          <p className="text-xs text-emerald-600/90">
            ✓ PWA 설치 및 푸시 알림이 켜져 있습니다.
          </p>
        ) : null}

        {pushReady && !standalone && !isIosDevice() ? (
          <p className="text-xs text-emerald-600/90">
            ✓ 푸시 알림이 켜져 있습니다. 백그라운드 수신을 위해 앱 설치를 권장합니다.
          </p>
        ) : null}
      </div>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-8 shrink-0"
        aria-label="닫기"
        onClick={dismiss}
      >
        <X className="size-4" />
      </Button>
    </div>
  );
}
