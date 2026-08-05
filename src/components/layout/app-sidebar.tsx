"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import {
  Bell,
  CalendarRange,
  ClipboardList,
  LayoutDashboard,
  MessageSquareText,
  Settings,
  Shield,
  Table2,
  CalendarCheck2,
} from "lucide-react";

import { useAuth } from "@/components/providers/auth-provider";
import { LogoutButton } from "@/components/auth/logout-button";
import { cn } from "@/lib/utils";

type SidebarLink = {
  href: string;
  label: string;
  icon: LucideIcon;
  /** 지정 시 경로 매칭 대신 이 함수로 활성 여부 판별 */
  isActive?: (pathname: string) => boolean;
};

type SidebarGroup = {
  label: string;
  items: SidebarLink[];
};

const overviewGroup: SidebarLink[] = [
  { href: "/dashboard", label: "마이페이지", icon: LayoutDashboard },
  { href: "/monthly-sheet", label: "월간 취합표", icon: Table2 },
  { href: "/notices", label: "Notices", icon: Bell },
  { href: "/bamboo-forest", label: "한대나무숲", icon: MessageSquareText },
];

const myWorkGroup: SidebarLink[] = [
  { href: "/applications", label: "Applications", icon: ClipboardList },
  { href: "/my-assignments", label: "내 주간 배정표", icon: CalendarCheck2 },
];

/** 진입 시 사용자 관리가 기본이 되도록 `/admin/users`로 연결 */
const adminNavItem: SidebarLink = {
  href: "/admin/users",
  label: "Admin",
  icon: Shield,
  isActive: (p) => p === "/admin" || p.startsWith("/admin/"),
};

const approvalCalendarNavItem: SidebarLink = {
  href: "/admin/approval-calendar",
  label: "승인 달력",
  icon: CalendarRange,
};

const settingsNavItem: SidebarLink = {
  href: "/settings",
  label: "Settings",
  icon: Settings,
};

function isLinkActive(pathname: string, { href, isActive }: SidebarLink) {
  return isActive
    ? isActive(pathname)
    : pathname === href || pathname.startsWith(`${href}/`);
}

function NavLink({ href, label, icon: Icon, active }: SidebarLink & { active: boolean }) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group relative flex items-center gap-3 rounded-md py-2 pl-3 pr-3 text-sm font-medium transition-colors",
        active
          ? "bg-accent/10 text-foreground"
          : "text-muted-foreground hover:bg-surface-hover hover:text-foreground",
      )}
    >
      <span
        className={cn(
          "absolute inset-y-1 left-0 w-[3px] rounded-full bg-accent transition-opacity",
          active ? "opacity-100" : "opacity-0",
        )}
        aria-hidden
      />
      <Icon
        className={cn(
          "size-4 shrink-0 transition-colors",
          active ? "text-accent" : "opacity-80 group-hover:opacity-100",
        )}
      />
      <span className="truncate">{label}</span>
    </Link>
  );
}

function NavGroup({ label, items, pathname }: SidebarGroup & { pathname: string }) {
  return (
    <div className="space-y-1">
      <p className="px-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
        {label}
      </p>
      <div className="space-y-0.5">
        {items.map((item) => (
          <NavLink key={item.href} {...item} active={isLinkActive(pathname, item)} />
        ))}
      </div>
    </div>
  );
}

function UserInitial({ name }: { name: string }) {
  const initial = name.trim().charAt(0).toUpperCase() || "?";
  return (
    <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-accent/15 text-xs font-semibold text-accent">
      {initial}
    </span>
  );
}

export function AppSidebar({ className }: { className?: string }) {
  const pathname = usePathname();
  const { user, profile, isAdmin } = useAuth();

  const displayName = profile?.displayName || user?.email || "로그인 사용자";
  const email = user?.email ?? profile?.email;

  return (
    <aside
      className={cn(
        "fixed inset-y-0 left-0 z-40 hidden w-60 flex-col border-r border-border bg-card md:flex",
        className,
      )}
    >
      <div className="flex h-14 shrink-0 items-center border-b border-border px-5">
        <Link href="/dashboard" className="text-base font-semibold tracking-tight">
          <span className="text-foreground">HAN</span>
          <span className="ml-1 text-accent">OPS</span>
        </Link>
      </div>

      <nav className="flex flex-1 flex-col gap-5 overflow-y-auto p-3">
        <NavGroup label="개요" items={overviewGroup} pathname={pathname} />
        <NavGroup label="내 업무" items={myWorkGroup} pathname={pathname} />
        <div className="space-y-1">
          <p className="px-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
            설정
          </p>
          <div className="space-y-0.5">
            {isAdmin ? (
              <NavLink {...adminNavItem} active={isLinkActive(pathname, adminNavItem)} />
            ) : null}
            {isAdmin ? (
              <NavLink
                {...approvalCalendarNavItem}
                active={isLinkActive(pathname, approvalCalendarNavItem)}
              />
            ) : null}
            <NavLink
              {...settingsNavItem}
              active={isLinkActive(pathname, settingsNavItem)}
            />
          </div>
        </div>
      </nav>

      <div className="shrink-0 border-t border-border p-3">
        <div className="flex items-center gap-2.5 rounded-md px-1 py-1.5">
          <UserInitial name={displayName} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-foreground">
              {profile?.displayName || "사용자"}
            </p>
            <p className="truncate text-xs text-muted-foreground">{email}</p>
          </div>
        </div>
        <LogoutButton fullWidth className="mt-2" />
      </div>
    </aside>
  );
}
