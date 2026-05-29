"use client";

import type { ReactNode } from "react";

import { AdminSubNav } from "@/components/admin/admin-sub-nav";

export function AdminShell({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <div className="min-w-0 space-y-6">
      <header className="space-y-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Admin</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            사용자 권한과 운영 도구 · 우선 사용자 관리에서 계정을 확인하세요.
          </p>
        </div>
        <AdminSubNav />
      </header>
      {children}
    </div>
  );
}
