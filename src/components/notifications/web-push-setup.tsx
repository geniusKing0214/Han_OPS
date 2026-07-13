"use client";

import { BellRing } from "lucide-react";

import { useWebPush } from "@/components/providers/web-push-provider";
import { needsPwaInstallForBackgroundPush } from "@/lib/pwa-utils";
import { Button } from "@/components/ui/button";

/** 알림 패널용 간단 푸시 허용 버튼 (상단 PWA 배너와 연동) */
export function WebPushSetup() {
  const {
    supported,
    configured,
    enabling,
    enablePush,
    permission,
    enabled,
    pushError,
    pushSuccessMessage,
    registeredTokenPreview,
  } = useWebPush();

  if (!supported || !configured) return null;

  if (needsPwaInstallForBackgroundPush()) {
    return (
      <p className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
        iPhone은 먼저 홈 화면에 HAN OPS를 추가한 뒤, 앱으로 실행해서 알림을
        허용하세요.
      </p>
    );
  }

  if (permission === "granted" && enabled) {
    return (
      <p className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-300">
        백그라운드 푸시 알림이 켜져 있습니다.
        {registeredTokenPreview ? ` (${registeredTokenPreview})` : ""}
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {permission === "granted" && !enabled ? (
        <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
          알림 권한은 허용됐지만 토큰 등록에 실패했습니다. 아래 버튼으로 다시
          시도하세요.
        </p>
      ) : null}

      {pushSuccessMessage ? (
        <p className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-200">
          ✅ {pushSuccessMessage}
        </p>
      ) : null}

      {pushError ? (
        <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
          {pushError}
        </p>
      ) : null}

      <Button
        type="button"
        size="sm"
        variant="accent"
        className="w-full gap-1.5"
        disabled={enabling}
        onClick={() => void enablePush()}
      >
        <BellRing className="size-3.5" />
        {enabling ? "설정 중..." : "푸시 알림 허용"}
      </Button>
    </div>
  );
}
