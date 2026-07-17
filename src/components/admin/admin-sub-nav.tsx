"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ExternalLink } from "lucide-react";

import { cn } from "@/lib/utils";

const items = [
  {
    href: "/admin/schedule",
    label: "일정",
    isActive: (p: string) => p.startsWith("/admin/schedule"),
  },
  {
    href: "/admin/availability",
    label: "근무 가능일 현황",
    isActive: (p: string) =>
      p === "/admin/availability" || p.startsWith("/admin/availability/"),
  },
  {
    href: "/admin/roster",
    label: "신청 인원 관리",
    isActive: (p: string) =>
      p === "/admin/roster" || p.startsWith("/admin/roster/"),
  },
  {
    href: "/admin/attendance",
    label: "출근 인증 관리",
    isActive: (p: string) =>
      p === "/admin/attendance" || p.startsWith("/admin/attendance/"),
  },
  {
    href: "/admin/registrations",
    label: "가입 승인",
    isActive: (p: string) =>
      p === "/admin/registrations" || p.startsWith("/admin/registrations/"),
  },
  {
    href: "/admin/users",
    label: "사용자 관리",
    isActive: (p: string) =>
      p === "/admin/users" || p.startsWith("/admin/users/"),
  },
  {
    href: "/admin/applications",
    label: "신청",
    isActive: (p: string) =>
      p === "/admin/applications" || p.startsWith("/admin/applications/"),
  },
  {
    href: "/admin/points",
    label: "포인트/랭킹",
    isActive: (p: string) =>
      p === "/admin/points" || p.startsWith("/admin/points/"),
  },
  {
    href: "/admin/monthly-sheet",
    label: "월간 취합표",
    isActive: (p: string) =>
      p === "/admin/monthly-sheet" || p.startsWith("/admin/monthly-sheet/"),
  },
] as const;

export function AdminSubNav() {
  const pathname = usePathname();

  return (
    <nav
      className="space-y-3 border-b border-border pb-3"
      aria-label="Admin 하위 메뉴"
    >
      <div
        className={cn(
          "items-stretch gap-0",
          "flex min-w-0 flex-nowrap overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
          "md:overflow-visible lg:grid lg:grid-cols-9",
        )}
      >
        {items.map(({ href, label, isActive }) => {
          const active = isActive(pathname);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "-mb-px inline-flex shrink-0 items-center justify-center whitespace-nowrap border-b-2 px-2.5 py-2 text-center text-sm font-medium transition-colors sm:px-3",
                "md:min-w-0 md:px-2",
                active
                  ? "border-accent text-foreground"
                  : "border-transparent text-muted-foreground hover:border-border hover:text-foreground",
              )}
            >
              {label}
            </Link>
          );
        })}
      </div>

      <Link
        href="/workforce-scheduler"
        className="inline-flex w-full items-center justify-between gap-2 rounded-xl border border-accent/30 bg-accent/10 px-3 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-accent/20 sm:w-auto"
      >
        <span>인력 배치 스케줄러 열기</span>
        <ExternalLink className="size-3.5 shrink-0 text-accent" />
      </Link>
    </nav>
  );
}
