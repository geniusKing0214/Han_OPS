import Link from "next/link";

import { AuthGuard } from "@/components/auth/auth-guard";
import { AdminRouteGuard } from "@/components/auth/admin-route-guard";

export default function WorkforceSchedulerLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <AuthGuard>
      <AdminRouteGuard>
        <div className="min-h-dvh bg-background text-foreground">
          <header className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur">
            <div className="mx-auto flex max-w-[1680px] items-center justify-between gap-3 px-3 py-2.5 sm:px-5">
              <div className="flex min-w-0 items-center gap-3">
                <Link
                  href="/admin/users"
                  className="shrink-0 rounded-lg px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground"
                >
                  ← Admin
                </Link>
                <div className="h-4 w-px bg-border" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold tracking-tight sm:text-base">
                    인력 배치 스케줄러
                  </p>
                  <p className="hidden text-[11px] text-muted-foreground sm:block">
                    HAN OPS · 주간 근무 배정
                  </p>
                </div>
              </div>
              <Link
                href="/dashboard"
                className="shrink-0 rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground"
              >
                대시보드
              </Link>
            </div>
          </header>
          <main className="mx-auto max-w-[1680px] px-2 py-3 sm:px-4 sm:py-4">
            {children}
          </main>
        </div>
      </AdminRouteGuard>
    </AuthGuard>
  );
}
