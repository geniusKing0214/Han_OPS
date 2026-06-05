"use client";

import { BellRing, X } from "lucide-react";

import { useWebPush } from "@/components/providers/web-push-provider";
import { Button } from "@/components/ui/button";

export function WebPushSetup() {
  const {
    shouldShowBanner,
    enabling,
    enablePush,
    dismissBanner,
    configured,
    supported,
  } = useWebPush();

  if (!supported) return null;

  if (!configured) {
    return (
      <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
        웹 푸시: Firebase Console에서 VAPID 키를 발급한 뒤{" "}
        <code className="text-[11px]">NEXT_PUBLIC_FIREBASE_VAPID_KEY</code> 환경
        변수를 설정하세요.
      </p>
    );
  }

  if (!shouldShowBanner) return null;

  return (
    <div className="flex items-start gap-3 rounded-lg border border-accent/30 bg-accent/10 px-4 py-3">
      <BellRing className="mt-0.5 size-5 shrink-0 text-accent" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">브라우저 알림 받기</p>
        <p className="mt-1 text-xs text-muted-foreground">
          사이트를 열지 않아도 새 스케줄·신청 결과 알림을 받을 수 있습니다.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant="accent"
            disabled={enabling}
            onClick={() => void enablePush()}
          >
            {enabling ? "설정 중..." : "알림 허용"}
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={dismissBanner}>
            나중에
          </Button>
        </div>
      </div>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-8 shrink-0"
        aria-label="닫기"
        onClick={dismissBanner}
      >
        <X className="size-4" />
      </Button>
    </div>
  );
}
