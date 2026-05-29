"use client";

import { MyApplicationRow } from "@/components/applications/my-application-row";
import { groupApplicationsByMonth } from "@/lib/application-grouping";
import type { ApplicationItem } from "@/types/application";

export function ApplicationListByMonth({
  items,
  userId,
  compact,
}: {
  items: ApplicationItem[];
  userId: string;
  compact?: boolean;
}) {
  const groups = groupApplicationsByMonth(items);

  return (
    <div className="space-y-5">
      {groups.map(({ monthKey, label, items: monthItems }) => (
        <section key={monthKey} className="space-y-2">
          <div className="sticky top-[calc(3.5rem+env(safe-area-inset-top,0px))] z-10 -mx-1 flex items-center justify-between gap-2 rounded-md border border-border/60 bg-background/95 px-3 py-2 backdrop-blur supports-[backdrop-filter]:bg-background/80">
            <h3 className="text-sm font-semibold tracking-tight">{label}</h3>
            <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
              {monthItems.length}건
            </span>
          </div>
          <div className="space-y-2">
            {monthItems.map((app) => (
              <MyApplicationRow
                key={app.id}
                app={app}
                userId={userId}
                compact={compact}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
