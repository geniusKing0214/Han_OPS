"use client";

import { Badge } from "@/components/ui/badge";
import { statusBadgeVariant } from "@/lib/admin-application-roster";
import { cn } from "@/lib/utils";
import type { SheetDayBundle } from "@/types/monthly-sheet";
import { TEAM_LABELS } from "@/types/team";

function statusLabel(status: string): string {
  if (status === "approved") return "승인";
  if (status === "completed") return "완료";
  if (status === "pending") return "대기";
  if (status === "rejected") return "거절";
  return status;
}

export function MonthlySheetDayDetail({
  bundle,
  dateLabel,
  showTeamBadge,
  className,
}: {
  bundle: SheetDayBundle | null;
  dateLabel: string;
  showTeamBadge?: boolean;
  className?: string;
}) {
  if (!bundle || bundle.rows.length === 0) {
    return (
      <div className={cn("rounded-lg border border-border bg-card p-4", className)}>
        <h3 className="text-sm font-semibold">{dateLabel}</h3>
        <p className="mt-3 text-sm text-muted-foreground">
          이 날짜에 표시할 일정이 없습니다.
        </p>
      </div>
    );
  }

  return (
    <div className={cn("space-y-3", className)}>
      <div>
        <h3 className="text-sm font-semibold">{dateLabel}</h3>
        {bundle.dayOverride?.manualText ? (
          <p className="mt-1 text-sm text-accent">{bundle.dayOverride.manualText}</p>
        ) : null}
        {bundle.dayOverride?.customMemo ? (
          <p className="mt-1 text-xs text-muted-foreground">
            {bundle.dayOverride.customMemo}
          </p>
        ) : null}
      </div>

      <div className="space-y-3">
        {bundle.rows.map((row) => (
          <div
            key={row.entryKey}
            className="rounded-lg border border-border bg-muted/20 p-3"
            style={
              row.override?.color || row.eventColor
                ? {
                    borderLeftWidth: 3,
                    borderLeftColor:
                      row.override?.color || row.eventColor || undefined,
                  }
                : undefined
            }
          >
            <div className="flex flex-wrap items-center gap-2">
              {showTeamBadge ? (
                <Badge variant="outline">{TEAM_LABELS[row.teamId]}</Badge>
              ) : null}
              <p className="text-sm font-medium">{row.eventTitle}</p>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {row.venue} · {row.slotTime} · 인원 {row.headcount}명
            </p>
            <p className="mt-1 text-xs text-muted-foreground">{row.statusLabel}</p>

            {row.applicants.length > 0 ? (
              <ul className="mt-2 space-y-1">
                {row.applicants.map((a, idx) => (
                  <li
                    key={`${row.entryKey}-a-${idx}`}
                    className="flex items-center gap-2 text-sm"
                  >
                    <Badge variant={statusBadgeVariant(a.status)} className="text-[10px]">
                      {statusLabel(a.status)}
                    </Badge>
                    <span>{a.name}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-xs text-muted-foreground">승인자 없음</p>
            )}

            {row.override?.displayMemo ? (
              <p className="mt-2 text-xs text-foreground/90">
                {row.override.displayMemo}
              </p>
            ) : null}
            {row.override?.extraMemo ? (
              <p className="mt-1 text-xs text-muted-foreground">
                {row.override.extraMemo}
              </p>
            ) : null}
            {row.eventNotice ? (
              <p className="mt-1 text-xs text-muted-foreground">
                [일정] {row.eventNotice}
              </p>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}
