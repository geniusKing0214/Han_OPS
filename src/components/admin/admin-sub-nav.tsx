"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

const items = [
  {
    href: "/admin/users",
    label: "사용자 관리",
    /** 활성: 사용자 구간만 (일정 경로와 구분) */
    isActive: (p: string) =>
      p === "/admin/users" || p.startsWith("/admin/users/"),
  },
  {
    href: "/admin/schedule",
    label: "일정",
    isActive: (p: string) => p.startsWith("/admin/schedule"),
  },
  {
    href: "/admin/applications",
    label: "신청",
    isActive: (p: string) =>
      p === "/admin/applications" || p.startsWith("/admin/applications/"),
  },
] as const;

export function AdminSubNav() {
  const pathname = usePathname();

  return (
    <nav
      className="flex flex-wrap gap-2 border-b border-border pb-px"
      aria-label="Admin 하위 메뉴"
    >
      {items.map(({ href, label, isActive }) => {
        const active = isActive(pathname);
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "-mb-px inline-flex items-center border-b-2 px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "border-accent text-foreground"
                : "border-transparent text-muted-foreground hover:border-border hover:text-foreground",
            )}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
