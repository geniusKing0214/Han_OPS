"use client";

import type { ReactNode } from "react";

import { AdminSubNav } from "@/components/admin/admin-sub-nav";
import { PageHeader } from "@/components/layout/page-header";

export function AdminShell({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <div className="min-w-0 space-y-6">
      <header className="space-y-4">
        <PageHeader
          title="Admin"
          description="사용자 권한과 운영 도구 · 우선 사용자 관리에서 계정을 확인하세요."
        />
        <AdminSubNav />
      </header>
      {children}
    </div>
  );
}
