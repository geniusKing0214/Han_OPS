"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { useAuth } from "@/components/providers/auth-provider";
import { Button } from "@/components/ui/button";

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, profile, loading, authReady, canAccessApp, logout } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (authReady && !loading && !user) {
      router.replace("/login");
    }
  }, [authReady, loading, router, user]);

  if (!authReady || loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center gap-2 text-sm text-muted-foreground">
        <span className="size-3.5 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-accent" />
        인증 상태 확인 중...
      </div>
    );
  }

  if (!user) {
    return null;
  }

  if (!profile) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 text-center">
        <p className="text-sm text-muted-foreground">
          프로필을 등록하는 중입니다. 잠시 후 다시 시도해 주세요.
        </p>
        <Button type="button" variant="outline" size="sm" onClick={() => void logout()}>
          로그아웃
        </Button>
      </div>
    );
  }

  if (!canAccessApp) {
    const pending = profile?.accountStatus === "pending";
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 text-center">
        <p className="text-sm text-muted-foreground">
          {pending
            ? "가입 승인 대기 중입니다. 관리자가 승인하면 이용할 수 있습니다."
            : "가입이 거절되었습니다. 관리자에게 문의해 주세요."}
        </p>
        <Button type="button" variant="outline" size="sm" onClick={() => void logout()}>
          로그아웃
        </Button>
      </div>
    );
  }

  return <>{children}</>;
}
