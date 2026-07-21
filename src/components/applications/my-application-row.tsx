"use client";

import { useMemo, useState } from "react";
import { Loader2 } from "lucide-react";

import { AttendanceStatusBlock } from "@/components/attendance/attendance-status-block";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useMyAttendances } from "@/hooks/use-my-attendances";
import { useEvents } from "@/hooks/use-events";
import {
  cancelActionLabel,
  cancelApplicationHint,
  canUserCancelApplication,
} from "@/lib/application-cancel";
import { cancelMyApplication } from "@/lib/firestore-applications";
import { statusLabels, type ApplicationItem } from "@/types/application";

function statusBadgeVariant(status: ApplicationItem["status"]) {
  if (status === "approved") return "success" as const;
  if (status === "pending") return "warning" as const;
  if (status === "rejected") return "destructive" as const;
  return "default" as const;
}

export function MyApplicationRow({
  app,
  userId,
  compact,
}: {
  app: ApplicationItem;
  userId: string;
  compact?: boolean;
}) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState("");
  const { events } = useEvents();
  const { items: attendances } = useMyAttendances();
  const event = useMemo(
    () => events.find((e) => e.id === app.eventId),
    [events, app.eventId],
  );

  const canCancel = canUserCancelApplication(app);
  const hint = cancelApplicationHint(app);
  const actionLabel = cancelActionLabel(app.status);

  const handleCancel = async () => {
    setCancelling(true);
    setError("");
    try {
      await cancelMyApplication(app.id, userId);
      setDialogOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "취소에 실패했습니다.");
    } finally {
      setCancelling(false);
    }
  };

  return (
    <>
      <div className="flex flex-col gap-3 rounded-lg border border-border px-4 py-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <p className="font-medium">{app.eventTitle}</p>
          <p className="text-sm text-muted-foreground">
            {app.venue} ·{" "}
            <span className="tabular-nums">
              {compact
                ? `${app.date} · ${app.slotTime}`
                : `${app.date} ${app.slotTime}`}
            </span>
          </p>
          {app.positionLabel ? (
            <p className="mt-0.5 text-xs text-muted-foreground">
              포지션:{" "}
              <span className="font-medium text-foreground">{app.positionLabel}</span>
              {app.positionSlotTime ? (
                <span className="ml-1 tabular-nums text-accent">· {app.positionSlotTime}</span>
              ) : null}
            </p>
          ) : null}
          {!compact && app.note ? (
            <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
              메모: {app.note}
            </p>
          ) : null}
          {!compact ? (
            <p className="mt-1 text-xs text-muted-foreground tabular-nums">
              접수 {app.submittedAt.replace("T", " ").slice(0, 16)}
            </p>
          ) : null}
          {app.status === "rejected" && app.rejectionReason ? (
            <p className="mt-1 line-clamp-2 text-xs text-red-300/90">
              거절 사유: {app.rejectionReason}
            </p>
          ) : null}
          <AttendanceStatusBlock
            app={app}
            event={event}
            attendances={attendances}
          />
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2 sm:flex-col sm:items-end">
          <Badge variant={statusBadgeVariant(app.status)} className="w-fit">
            {statusLabels[app.status]}
          </Badge>
          {canCancel ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 border-red-500/30 text-red-400 hover:bg-red-500/10 hover:text-red-300"
              onClick={() => {
                setError("");
                setDialogOpen(true);
              }}
            >
              {actionLabel}
            </Button>
          ) : null}
        </div>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>신청 {actionLabel}</DialogTitle>
            <DialogDescription asChild>
              <div className="space-y-2 pt-1 text-left text-sm text-muted-foreground">
                <p>
                  <span className="font-medium text-foreground">{app.eventTitle}</span>
                  <br />
                  {app.date} {app.slotTime} · {app.venue}
                </p>
                {hint ? <p>{hint}</p> : null}
              </div>
            </DialogDescription>
          </DialogHeader>
          {error ? (
            <p className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
              {error}
            </p>
          ) : null}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="ghost"
              disabled={cancelling}
              onClick={() => setDialogOpen(false)}
            >
              닫기
            </Button>
            <Button
              type="button"
              variant="outline"
              className="border-red-500/40 text-red-400 hover:bg-red-500/10 hover:text-red-300"
              disabled={cancelling}
              onClick={() => void handleCancel()}
            >
              {cancelling ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  처리 중...
                </>
              ) : (
                `${actionLabel}하기`
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
