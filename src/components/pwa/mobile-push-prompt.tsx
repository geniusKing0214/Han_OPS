"use client";

import { useEffect, useState } from "react";
import { BellRing, Smartphone } from "lucide-react";

import { useAuth } from "@/components/providers/auth-provider";
import { useWebPush } from "@/components/providers/web-push-provider";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { isMobileDevice, needsPwaInstallForBackgroundPush } from "@/lib/pwa-utils";
import { isPushRelayConfigured } from "@/lib/push-relay";

const MOBILE_PUSH_PROMPT_KEY = "han-ops-mobile-push-prompt-dismissed";

/** 모바일에서 백그라운드 푸시 등록을 유도하는 1회성 안내 */
export function MobilePushPrompt() {
  const { canAccessApp, profile } = useAuth();
  const { supported, configured, enabled, permission, enabling, enablePush } =
    useWebPush();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!canAccessApp || profile?.accountStatus !== "approved") return;
    if (!isMobileDevice() || !supported) return;
    if (needsPwaInstallForBackgroundPush()) return;
    if (permission === "granted" && enabled) return;
    if (localStorage.getItem(MOBILE_PUSH_PROMPT_KEY) === "1") return;
    setOpen(true);
  }, [canAccessApp, profile?.accountStatus, supported, permission, enabled]);

  const dismiss = () => {
    localStorage.setItem(MOBILE_PUSH_PROMPT_KEY, "1");
    setOpen(false);
  };

  const handleEnable = async () => {
    const ok = await enablePush();
    if (ok) {
      localStorage.setItem(MOBILE_PUSH_PROMPT_KEY, "1");
      setOpen(false);
    }
  };

  if (!open) return null;

  const relayReady = isPushRelayConfigured();

  return (
    <Sheet open={open} onOpenChange={(next) => !next && dismiss()}>
      <SheetContent side="bottom" className="rounded-t-2xl pb-8">
        <SheetHeader className="text-left">
          <SheetTitle className="flex items-center gap-2">
            <Smartphone className="size-5 text-accent" />
            모바일 백그라운드 알림
          </SheetTitle>
          <SheetDescription>
            앱을 닫아도 새 스케줄·승인·공지 알림을 받으려면 알림을 허용해 주세요.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-4 space-y-3 text-sm">
          <ol className="list-decimal space-y-1.5 pl-4 text-muted-foreground">
            <li>아래 버튼으로 알림 허용</li>
            <li>설정 → 푸시 알림에서 등록 상태 확인</li>
          </ol>

          {!relayReady ? (
            <p className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
              서버 푸시 릴레이가 아직 설정되지 않았습니다. 관리자가 Cloudflare
              Worker 배포 후 앱을 다시 배포해야 백그라운드 OS 알림이 동작합니다.
            </p>
          ) : null}

          <div className="flex gap-2 pt-1">
            <Button
              type="button"
              variant="accent"
              className="flex-1 gap-1.5"
              disabled={enabling || !configured}
              onClick={() => void handleEnable()}
            >
              <BellRing className="size-4" />
              {enabling ? "설정 중…" : "알림 허용하기"}
            </Button>
            <Button type="button" variant="outline" onClick={dismiss}>
              나중에
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
