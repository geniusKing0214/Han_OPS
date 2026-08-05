"use client";

import { useEffect, useState } from "react";
import { BellRing, CheckCircle2, Smartphone, XCircle } from "lucide-react";

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

type PromptPhase = "prompt" | "success" | "error";

/** 모바일에서 백그라운드 푸시 등록을 유도하는 1회성 안내 */
export function MobilePushPrompt() {
  const { canAccessApp, profile } = useAuth();
  const { supported, configured, enabled, permission, enabling, enablePush } =
    useWebPush();
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<PromptPhase>("prompt");
  const [resultMessage, setResultMessage] = useState("");

  useEffect(() => {
    if (!canAccessApp || profile?.accountStatus !== "approved") return;
    if (!isMobileDevice() || !supported) return;
    if (needsPwaInstallForBackgroundPush()) return;
    if (permission === "granted" && enabled) return;
    if (localStorage.getItem(MOBILE_PUSH_PROMPT_KEY) === "1") return;
    setOpen(true);
    setPhase("prompt");
    setResultMessage("");
  }, [canAccessApp, profile?.accountStatus, supported, permission, enabled]);

  const dismiss = () => {
    localStorage.setItem(MOBILE_PUSH_PROMPT_KEY, "1");
    setOpen(false);
    setPhase("prompt");
    setResultMessage("");
  };

  const handleEnable = async () => {
    const result = await enablePush();
    if (result.ok) {
      setPhase("success");
      setResultMessage(
        result.message ??
          `푸시 등록이 완료되었습니다.${result.tokenPreview ? ` (${result.tokenPreview})` : ""}`,
      );
      localStorage.setItem(MOBILE_PUSH_PROMPT_KEY, "1");
      return;
    }
    setPhase("error");
    setResultMessage(result.error ?? "푸시 등록에 실패했습니다. 설정에서 다시 시도해 주세요.");
  };

  if (!open) return null;

  const relayReady = isPushRelayConfigured();

  return (
    <Sheet open={open} onOpenChange={(next) => !next && dismiss()}>
      <SheetContent side="bottom" className="rounded-t-2xl pb-8">
        <SheetHeader className="text-left">
          <SheetTitle className="flex items-center gap-2">
            {phase === "success" ? (
              <CheckCircle2 className="size-5 text-emerald-600" />
            ) : phase === "error" ? (
              <XCircle className="size-5 text-red-600" />
            ) : (
              <Smartphone className="size-5 text-accent" />
            )}
            {phase === "success"
              ? "푸시 등록 완료"
              : phase === "error"
                ? "푸시 등록 실패"
                : "모바일 백그라운드 알림"}
          </SheetTitle>
          <SheetDescription>
            {phase === "success"
              ? "이 기기의 FCM 토큰이 Firestore에 저장되었습니다."
              : phase === "error"
                ? "아래 내용을 확인한 뒤 설정에서 다시 시도해 주세요."
                : "앱을 닫아도 새 스케줄·승인·공지 알림을 받으려면 알림을 허용해 주세요."}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-4 space-y-3 text-sm">
          {phase === "prompt" ? (
            <>
              <ol className="list-decimal space-y-1.5 pl-4 text-muted-foreground">
                <li>아래 버튼으로 알림 허용</li>
                <li>완료 메시지가 뜨면 등록 성공</li>
                <li>설정 → 푸시 알림에서도 상태 확인 가능</li>
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
                  {enabling ? "등록 중…" : "알림 허용하기"}
                </Button>
                <Button type="button" variant="outline" onClick={dismiss}>
                  나중에
                </Button>
              </div>
            </>
          ) : null}

          {phase === "success" ? (
            <>
              <p className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-200">
                ✅ {resultMessage}
              </p>
              <p className="text-xs text-muted-foreground">
                설정 → 푸시 알림에서 「6. FCM 토큰」이 초록색이면 정상입니다.
              </p>
              <Button type="button" variant="accent" className="w-full" onClick={dismiss}>
                확인
              </Button>
            </>
          ) : null}

          {phase === "error" ? (
            <>
              <p className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-700">
                ❌ {resultMessage}
              </p>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="accent"
                  className="flex-1"
                  disabled={enabling || !configured}
                  onClick={() => void handleEnable()}
                >
                  {enabling ? "등록 중…" : "다시 시도"}
                </Button>
                <Button type="button" variant="outline" onClick={dismiss}>
                  닫기
                </Button>
              </div>
            </>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}
