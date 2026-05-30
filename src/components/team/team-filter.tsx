"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { TEAM_IDS, TEAM_LABELS, type TeamFilterValue } from "@/types/team";

const OPTIONS: { value: TeamFilterValue; label: string }[] = [
  { value: "all", label: "전체" },
  ...TEAM_IDS.map((id) => ({ value: id, label: TEAM_LABELS[id] })),
];

export function TeamFilter({
  value,
  onChange,
  className,
}: {
  value: TeamFilterValue;
  onChange: (value: TeamFilterValue) => void;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "inline-flex flex-wrap gap-1 rounded-md border border-border bg-card p-1",
        className,
      )}
    >
      {OPTIONS.map((opt) => (
        <Button
          key={opt.value}
          type="button"
          size="sm"
          variant={value === opt.value ? "accent" : "ghost"}
          className="h-8 px-3 text-xs"
          onClick={() => onChange(opt.value)}
        >
          {opt.label}
        </Button>
      ))}
    </div>
  );
}
