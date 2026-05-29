"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { useAuth } from "@/components/providers/auth-provider";

export function AdminRouteGuard({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading, authReady, isAdmin } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!authReady || loading) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    if (!isAdmin) {
      router.replace("/dashboard");
    }
  }, [authReady, loading, user, isAdmin, router]);

  if (!authReady || loading || !user || !isAdmin) {
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
        <p>관리자 화면 접근 확인 중...</p>
        {!authReady || loading ? null : !loading && user && !isAdmin ? (
          <p className="text-xs">일반 사용자는 Admin에 접근할 수 없습니다.</p>
        ) : null}
      </div>
    );
  }

  return <>{children}</>;
}
