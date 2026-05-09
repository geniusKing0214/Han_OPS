"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bell,
  Calendar,
  ClipboardList,
  LayoutDashboard,
  MoreHorizontal,
  Shield,
  Settings,
} from "lucide-react";

import { cn } from "@/lib/utils";
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

const primary = [
  { href: "/dashboard", label: "홈", icon: LayoutDashboard },
  { href: "/schedule", label: "일정", icon: Calendar },
  { href: "/applications", label: "신청", icon: ClipboardList },
  { href: "/notices", label: "공지", icon: Bell },
];

export function MobileBottomNav({ className }: { className?: string }) {
  const pathname = usePathname();
  const { isAdmin } = useAuth();

  return (
    <nav
      className={cn(
        "fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden",
        className,
      )}
    >
      <div className="flex h-14 items-center justify-around px-1">
        {primary.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 py-1 text-[10px] font-medium",
                active ? "text-accent" : "text-muted-foreground",
              )}
            >
              <Icon
                className={cn("size-5", active && "text-accent")}
                strokeWidth={active ? 2.25 : 2}
              />
              <span className="truncate">{label}</span>
            </Link>
          );
        })}

        <Sheet>
          <SheetTrigger asChild>
            <Button
              variant="ghost"
              className="h-14 min-w-0 flex-1 flex-col gap-0.5 rounded-none py-1 text-[10px] font-medium text-muted-foreground"
            >
              <MoreHorizontal className="size-5" />
              더보기
            </Button>
          </SheetTrigger>
          <SheetContent side="bottom" className="rounded-t-xl">
            <SheetHeader>
              <SheetTitle>메뉴</SheetTitle>
            </SheetHeader>
            <div className="mt-4 flex flex-col gap-2">
              {isAdmin ? (
                <SheetClose asChild>
                  <Link
                    href="/admin/users"
                    className="flex items-center gap-3 rounded-lg border border-border bg-muted px-4 py-3 text-sm font-medium hover:bg-surface-hover"
                  >
                    <Shield className="size-4" />
                    Admin
                  </Link>
                </SheetClose>
              ) : (
                <p className="rounded-lg border border-dashed border-border px-4 py-3 text-xs text-muted-foreground">
                  Admin 메뉴는 관리자 계정만 표시됩니다.
                </p>
              )}
              <SheetClose asChild>
                <Link
                  href="/settings"
                  className="flex items-center gap-3 rounded-lg border border-border bg-muted px-4 py-3 text-sm font-medium hover:bg-surface-hover"
                >
                  <Settings className="size-4" />
                  Settings
                </Link>
              </SheetClose>
              <Separator className="my-2" />
              <p className="text-xs text-muted-foreground">
                한손 조작을 위해 주 메뉴는 하단 고정입니다.
              </p>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </nav>
  );
}
