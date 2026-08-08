"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import {
  Bell,
  CalendarCheck2,
  CalendarRange,
  ClipboardList,
  GraduationCap,
  History,
  LayoutDashboard,
  MessageSquareText,
  MoreHorizontal,
  Settings,
  Shield,
  Table2,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { LogoutButton } from "@/components/auth/logout-button";
import { useAuth } from "@/components/providers/auth-provider";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";

type MoreLink = {
  href: string;
  label: string;
  icon: LucideIcon;
};

const primary = [
  { href: "/dashboard", label: "홈", icon: LayoutDashboard },
  { href: "/monthly-sheet", label: "취합표", icon: Table2 },
  { href: "/applications", label: "신청", icon: ClipboardList },
  { href: "/notices", label: "공지", icon: Bell },
];

const moreLinks: MoreLink[] = [
  { href: "/my-assignments", label: "내 주간 배정표", icon: CalendarCheck2 },
  { href: "/training", label: "교육신청", icon: GraduationCap },
  { href: "/bamboo-forest", label: "한대나무숲", icon: MessageSquareText },
];

function MoreLinkItem({ href, label, icon: Icon }: MoreLink) {
  return (
    <SheetClose asChild>
      <Link
        href={href}
        className="flex items-center gap-3 rounded-lg border border-border bg-muted px-4 py-3 text-sm font-medium transition-colors hover:bg-surface-hover"
      >
        <Icon className="size-4 text-muted-foreground" />
        {label}
      </Link>
    </SheetClose>
  );
}

export function MobileBottomNav({ className }: { className?: string }) {
  const pathname = usePathname();
  const { isAdmin } = useAuth();

  const moreActive = moreLinks.some(
    ({ href }) => pathname === href || pathname.startsWith(`${href}/`),
  );

  return (
    <nav
      className={cn(
        "fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden",
        className,
      )}
    >
      <div className="flex h-14 items-stretch justify-around px-1">
        {primary.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={href}
              className="flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 py-1 text-[10px] font-medium"
            >
              <Icon
                className={cn("size-5", active ? "text-accent" : "text-muted-foreground")}
                strokeWidth={active ? 2.25 : 2}
              />
              <span className={cn("truncate", active ? "text-accent" : "text-muted-foreground")}>
                {label}
              </span>
            </Link>
          );
        })}

        <Sheet>
          <SheetTrigger asChild>
            <Button
              variant="ghost"
              className={cn(
                "h-14 min-w-0 flex-1 flex-col gap-0.5 rounded-none py-1 text-[10px] font-medium hover:bg-transparent",
                moreActive ? "text-accent" : "text-muted-foreground",
              )}
            >
              <MoreHorizontal className="size-5" strokeWidth={moreActive ? 2.25 : 2} />
              더보기
            </Button>
          </SheetTrigger>
          <SheetContent side="bottom" className="max-h-[85dvh] rounded-t-xl">
            <SheetHeader>
              <SheetTitle>메뉴</SheetTitle>
            </SheetHeader>
            <div className="mt-4 flex flex-col gap-2">
              <p className="px-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                내 업무
              </p>
              {moreLinks.map((link) => (
                <MoreLinkItem key={link.href} {...link} />
              ))}

              <p className="mt-2 px-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                설정
              </p>
              {isAdmin ? (
                <>
                  <MoreLinkItem href="/admin/users" label="Admin" icon={Shield} />
                  <MoreLinkItem
                    href="/approval-calendar"
                    label="승인 달력"
                    icon={CalendarRange}
                  />
                  <MoreLinkItem href="/logs" label="활동 로그" icon={History} />
                </>
              ) : (
                <p className="rounded-lg border border-dashed border-border px-4 py-3 text-xs text-muted-foreground">
                  Admin 메뉴는 관리자 계정만 표시됩니다.
                </p>
              )}
              <MoreLinkItem href="/settings" label="Settings" icon={Settings} />

              <Separator className="my-2" />
              <LogoutButton fullWidth variant="outline" />
              <p className="text-center text-xs text-muted-foreground">
                한손 조작을 위해 주 메뉴는 하단 고정입니다.
              </p>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </nav>
  );
}
