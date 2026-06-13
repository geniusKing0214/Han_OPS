import type { SheetDayBundle } from "@/types/monthly-sheet";
import { monthLabelFromDate } from "@/types/monthly-sheet";
import { TEAM_LABELS, type TeamFilterValue } from "@/types/team";

function escapeCsv(value: string | number): string {
  return `"${String(value).replace(/"/g, '""')}"`;
}

export function exportMonthlySheetCsv(input: {
  month: Date;
  teamFilter: TeamFilterValue;
  days: Map<string, SheetDayBundle>;
  adminMemo?: string;
}): void {
  const monthLabel = monthLabelFromDate(input.month);
  const teamLabel =
    input.teamFilter === "all"
      ? "전체"
      : TEAM_LABELS[input.teamFilter];

  const header = [
    "날짜",
    "팀",
    "이벤트",
    "장소",
    "시간",
    "승인자",
    "인원",
    "상태",
    "메모",
    "관리자메모",
  ];

  const lines: string[] = [];
  const sortedDates = [...input.days.keys()].sort();

  for (const date of sortedDates) {
    const bundle = input.days.get(date);
    if (!bundle || bundle.rows.length === 0) continue;

    for (const row of bundle.rows) {
      const approved = row.applicants
        .filter((a) => a.status === "approved" || a.status === "completed")
        .map((a) => a.name)
        .join(" / ");
      const pending = row.applicants
        .filter((a) => a.status === "pending")
        .map((a) => a.name)
        .join(" / ");

      const names = approved || pending || "—";
      const memoParts = [
        row.override?.displayMemo,
        row.override?.extraMemo,
        row.eventNotice,
        bundle.dayOverride?.customMemo,
        bundle.dayOverride?.manualText,
      ]
        .filter(Boolean)
        .join(" · ");

      lines.push(
        [
          date,
          TEAM_LABELS[row.teamId],
          row.eventTitle,
          row.venue,
          row.slotTime,
          names,
          row.headcount,
          row.statusLabel,
          memoParts || "—",
          input.adminMemo?.trim() || "—",
        ]
          .map(escapeCsv)
          .join(","),
      );
    }
  }

  const bom = "\uFEFF";
  const csv = bom + [header.join(","), ...lines].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `han-ops-monthly-${monthLabel.replace(/\s/g, "")}-${teamLabel}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
