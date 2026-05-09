"use client";

import Link from "next/link";

import { cn } from "@/lib/utils";

export function MobileTopBar({ className }: { className?: string }) {
  return (
    <header
      className={cn(
        "sticky top-0 z-30 flex h-14 items-center border-b border-border bg-background/80 px-4 backdrop-blur md:hidden",
        className,
      )}
    >
      <Link href="/dashboard" className="font-semibold tracking-tight">
        <span className="text-foreground">HAN</span>
        <span className="ml-1 text-accent">OPS</span>
      </Link>
      <span className="ml-auto text-xs text-muted-foreground">딜러팀</span>
    </header>
  );
}
