"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/** 넓은 표(달력 등)가 필요한 페이지는 기본 max-w-5xl 제한 없이
 * 화면 폭을 꽉 채운다. */
const FULL_WIDTH_PATHS = ["/approval-calendar"];

function isFullWidthPath(pathname: string): boolean {
  return FULL_WIDTH_PATHS.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
}

export function PageWidthContainer({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const fullWidth = isFullWidthPath(pathname);

  return (
    <div
      className={cn(
        "mx-auto w-full min-w-0",
        fullWidth ? "max-w-none" : "max-w-5xl",
      )}
    >
      {children}
    </div>
  );
}
