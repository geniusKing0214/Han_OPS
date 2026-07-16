"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import {
  Bell,
  Calendar,
  ClipboardList,
  LayoutDashboard,
  Settings,
  Shield,
  Table2,
  CalendarCheck2,
} from "lucide-react";

import { useAuth } from "@/components/providers/auth-provider";
import { LogoutButton } from "@/components/auth/logout-button";
import { cn } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";

type SidebarLink = {
  href: string;
  label: string;
  icon: LucideIcon;
  /** 지정 시 경로 매칭 대신 이 함수로 활성 여부 판별 */
  isActive?: (pathname: string) => boolean;
};

const baseNav: SidebarLink[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/schedule", label: "Schedule", icon: Calendar },
  { href: "/applications", label: "Applications", icon: ClipboardList },
  { href: "/my-assignments", label: "내 주간 배정표", icon: CalendarCheck2 },
  { href: "/monthly-sheet", label: "취합표", icon: Table2 },
  { href: "/notices", label: "Notices", icon: Bell },
];

/** 진입 시 사용자 관리가 기본이 되도록 `/admin/users`로 연결 */
const adminNavItem: SidebarLink = {
  href: "/admin/users",
  label: "Admin",
  icon: Shield,
  isActive: (p) => p === "/admin" || p.startsWith("/admin/"),
};

const settingsNavItem: SidebarLink = {
  href: "/settings",
  label: "Settings",
  icon: Settings,
};

export function AppSidebar({ className }: { className?: string }) {
  const pathname = usePathname();
  const { user, profile, isAdmin } = useAuth();

  const nav: SidebarLink[] = [
    ...baseNav,
    ...(isAdmin ? [adminNavItem] : []),
    settingsNavItem,
  ];

  return (
    <aside
      className={cn(
        "fixed inset-y-0 left-0 z-40 hidden w-[240px] flex-col border-r border-border bg-card md:flex",
        className,
      )}
    >
      <div className="flex h-14 items-center border-b border-border px-5">
        <Link href="/dashboard" className="font-semibold tracking-tight">
          <span className="text-foreground">HAN</span>
          <span className="ml-1 text-accent">OPS</span>
        </Link>
      </div>
      <nav className="flex flex-1 flex-col gap-0.5 p-3">
        {nav.map(({ href, label, icon: Icon, isActive }) => {
          const active = isActive
            ? isActive(pathname)
            : pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-muted text-foreground"
                  : "text-muted-foreground hover:bg-surface-hover hover:text-foreground",
              )}
            >
              <Icon className="size-4 shrink-0 opacity-80" />
              {label}
            </Link>
          );
        })}
      </nav>
      <Separator />
      <div className="space-y-2 p-4">
        <p className="truncate text-xs text-muted-foreground">
          {profile?.displayName
            ? `${profile.displayName} (${user?.email ?? profile.email})`
            : user?.email ?? "로그인 사용자"}
        </p>
        <LogoutButton fullWidth />
      </div>
    </aside>
  );
}
