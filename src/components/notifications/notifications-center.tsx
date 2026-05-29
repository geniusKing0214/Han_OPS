"use client";

import { useEffect, useRef, useState } from "react";
import { Bell } from "lucide-react";

import { NotificationDetail } from "@/components/notifications/notification-detail";
import { NotificationList } from "@/components/notifications/notification-list";
import { useAuth } from "@/components/providers/auth-provider";
import { useMediaQuery } from "@/hooks/use-media-query";
import { useNotifications } from "@/hooks/use-notifications";
import {
  markAllNotificationsRead,
  markNotificationRead,
  syncAdminUidsConfig,
} from "@/lib/firestore-notifications";
import { listUsersForAdmin } from "@/lib/firestore-users";
import { withBasePath } from "@/lib/base-path";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import type { NotificationItem } from "@/types/notification";

function scheduleHrefFor(item: NotificationItem, isAdmin: boolean) {
  if (isAdmin && item.type === "application_submitted") {
    return withBasePath("/admin/applications");
  }
  return withBasePath("/applications");
}

export function NotificationsCenter({ className }: { className?: string }) {
  const { user, isAdmin } = useAuth();
  const isDesktop = useMediaQuery("(min-width: 768px)");
  const { items, loading, unreadCount } = useNotifications();
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState<NotificationItem | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isAdmin || !user) return;
    void (async () => {
      try {
        const rows = await listUsersForAdmin();
        const adminUids = rows.filter((r) => r.role === "admin").map((r) => r.uid);
        if (adminUids.length > 0) {
          await syncAdminUidsConfig(adminUids);
        }
      } catch {
        // config 동기화 실패해도 앱은 동작
      }
    })();
  }, [isAdmin, user]);

  useEffect(() => {
    if (!open || isDesktop) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open, isDesktop]);

  useEffect(() => {
    if (!open || !isDesktop) return;
    const onDoc = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        const bell = document.getElementById("notifications-bell-trigger");
        if (bell?.contains(e.target as Node)) return;
        setOpen(false);
        setDetail(null);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open, isDesktop]);

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) setDetail(null);
  };

  const handleSelect = async (item: NotificationItem) => {
    if (!item.isRead) {
      try {
        await markNotificationRead(item.id);
      } catch {
        // ignore
      }
    }
    if (isDesktop) return;
    setDetail(item);
  };

  const handleMarkAllRead = async () => {
    if (!user) return;
    try {
      await markAllNotificationsRead(items, user.uid);
    } catch {
      // ignore
    }
  };

  const panelHeader = (
    <div className="flex items-center justify-between gap-2 border-b border-border pb-3">
      <h3 className="text-sm font-semibold">알림</h3>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-8 text-xs text-accent hover:text-accent"
        disabled={unreadCount === 0}
        onClick={() => void handleMarkAllRead()}
      >
        전체 읽음
      </Button>
    </div>
  );

  const bellButton = (
    <Button
      id="notifications-bell-trigger"
      type="button"
      variant="ghost"
      size="icon"
      className={cn("relative size-9 shrink-0", className)}
      aria-label={`알림${unreadCount > 0 ? `, ${unreadCount}개 읽지 않음` : ""}`}
      onClick={() => handleOpenChange(!open)}
    >
      <Bell className="size-5" />
      {unreadCount > 0 ? (
        <span className="absolute -right-0.5 -top-0.5 flex min-w-[18px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold text-white">
          {unreadCount > 9 ? "9+" : unreadCount}
        </span>
      ) : null}
    </Button>
  );

  if (!user) return null;

  return (
    <div className="relative" ref={panelRef}>
      {bellButton}

      {isDesktop && open ? (
        <div className="absolute right-0 top-full z-50 mt-2 w-[min(380px,calc(100dvw-2rem))] rounded-xl border border-border bg-card p-4 shadow-xl">
          {panelHeader}
          <div className="mt-3">
            <NotificationList
              items={items}
              loading={loading}
              onSelect={(item) => void handleSelect(item)}
            />
          </div>
          {items.some((n) => n.applicationId || n.eventId) ? (
            <p className="mt-3 text-center text-xs text-muted-foreground">
              카드를 누르면 읽음 처리됩니다.
            </p>
          ) : null}
        </div>
      ) : null}

      {!isDesktop ? (
        <Sheet open={open} onOpenChange={handleOpenChange}>
          <SheetContent
            side="bottom"
            className="flex max-h-[88dvh] flex-col rounded-t-xl px-4 pt-2"
          >
            <div className="mx-auto mb-2 h-1 w-10 shrink-0 rounded-full bg-muted" />
            {detail ? (
              <NotificationDetail
                item={detail}
                onBack={() => setDetail(null)}
                scheduleHref={scheduleHrefFor(detail, isAdmin)}
              />
            ) : (
              <>
                <SheetHeader className="space-y-0 text-left">
                  <SheetTitle className="sr-only">알림</SheetTitle>
                  {panelHeader}
                </SheetHeader>
                <div className="mt-3 min-h-0 flex-1">
                  <NotificationList
                    items={items}
                    loading={loading}
                    onSelect={(item) => void handleSelect(item)}
                    maxHeightClass="max-h-[min(60dvh,520px)]"
                  />
                </div>
              </>
            )}
          </SheetContent>
        </Sheet>
      ) : null}
    </div>
  );
}
