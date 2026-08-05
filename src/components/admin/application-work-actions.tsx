"use client";

import type { ApplicationItem } from "@/types/application";
import { statusLabels } from "@/types/application";
import type { WorkStatus } from "@/types/points";
import { WORK_STATUS_LABELS } from "@/types/points";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function workStatusBadgeVariant(
  ws: WorkStatus,
): "success" | "destructive" | "warning" | "outline" {
  if (ws === "completed") return "success";
  if (ws === "no_show") return "destructive";
  if (ws === "late_cancel") return "warning";
  return "outline";
}

export function ApplicationWorkActions({
  application: a,
  busy,
  onApprove,
  onReject,
  onWorkStatus,
}: {
  application: ApplicationItem;
  busy: boolean;
  onApprove: () => void;
  onReject: () => void;
  onWorkStatus: (status: WorkStatus) => void;
}) {
  const ws = a.workStatus ?? "not_checked";

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-1.5">
        <Badge
          variant={
            a.status === "approved"
              ? "accent"
              : a.status === "pending"
                ? "warning"
                : a.status === "rejected"
                  ? "destructive"
                  : "default"
          }
        >
          {statusLabels[a.status]}
        </Badge>
        {ws !== "not_checked" ? (
          <Badge variant={workStatusBadgeVariant(ws)}>{WORK_STATUS_LABELS[ws]}</Badge>
        ) : null}
        {a.pointsAwarded ? (
          <span className="text-[10px] text-muted-foreground">포인트 반영됨</span>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-1.5">
        {a.status === "pending" ? (
          <>
            <Button
              type="button"
              size="sm"
              variant="accent"
              className="bg-blue-600/90 text-white hover:bg-blue-600"
              disabled={busy}
              onClick={onApprove}
            >
              승인
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="text-red-600 hover:bg-red-500/10"
              disabled={busy}
              onClick={onReject}
            >
              거절
            </Button>
          </>
        ) : null}

        {a.status === "approved" || a.status === "completed" ? (
          <>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className={cn(
                "border-emerald-500/40 text-emerald-600 hover:bg-emerald-500/10",
                ws === "completed" && "ring-1 ring-emerald-500/50",
              )}
              disabled={busy}
              onClick={() => onWorkStatus("completed")}
            >
              근무완료
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className={cn(
                "text-red-600 hover:bg-red-500/10",
                ws === "no_show" && "ring-1 ring-red-500/50",
              )}
              disabled={busy}
              onClick={() => onWorkStatus("no_show")}
            >
              결근
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className={cn(
                "border-amber-500/40 text-amber-600 hover:bg-amber-500/10",
                ws === "late_cancel" && "ring-1 ring-amber-500/50",
              )}
              disabled={busy}
              onClick={() => onWorkStatus("late_cancel")}
            >
              당일취소
            </Button>
          </>
        ) : null}
      </div>
    </div>
  );
}
