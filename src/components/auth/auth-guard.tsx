"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { useAuth } from "@/components/providers/auth-provider";
import { Button } from "@/components/ui/button";

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, profile, loading, canAccessApp, logout } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
    }
  }, [loading, router, user]);

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-sm text-muted-foreground">
        인증 상태 확인 중...
      </div>
    );
  }

  if (!user) {
    return null;
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
