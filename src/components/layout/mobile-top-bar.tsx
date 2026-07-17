"use client";

import Link from "next/link";

import { NotificationsCenter } from "@/components/notifications/notifications-center";
import { cn } from "@/lib/utils";

export function MobileTopBar({ className }: { className?: string }) {
  return (
    <header
      className={cn(
        "sticky top-0 z-30 flex min-h-14 items-center gap-2 border-b border-border bg-background/80 px-4 pt-[env(safe-area-inset-top)] backdrop-blur md:hidden",
        className,
      )}
    >
      <Link href="/dashboard" className="text-base font-semibold tracking-tight">
        <span className="text-foreground">HAN</span>
        <span className="ml-1 text-accent">OPS</span>
      </Link>
      <div className="ml-auto flex items-center">
        <NotificationsCenter />
      </div>
    </header>
  );
}
