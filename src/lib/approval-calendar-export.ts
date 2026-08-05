import ExcelJS from "exceljs";

import type { ApprovalCalendarDay } from "@/lib/approval-calendar-aggregator";
import { buildCalendarWeeks } from "@/components/admin/approval-calendar/approval-calendar-grid";

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];
const DEFAULT_ARGB = "FF14161C";

function hexToArgb(hex?: string): string {
  const trimmed = hex?.trim().replace(/^#/, "");
  if (!trimmed || !/^[0-9a-fA-F]{6}$/.test(trimmed)) return DEFAULT_ARGB;
  return `FF${trimmed.toUpperCase()}`;
}

/** 5개씩 끊어 이름 배열을 줄 단위 문자열로 변환 (화면과 동일한 1행5열 규칙) */
function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

function buildCellRichText(
  bundle: ApprovalCalendarDay | undefined,
): ExcelJS.RichText[] {
  if (!bundle || bundle.entries.length === 0) return [{ text: "" }];

  const runs: ExcelJS.RichText[] = [];
  bundle.entries.forEach((entry, entryIdx) => {
    if (entryIdx > 0) runs.push({ text: "\n" });
    runs.push({
      font: { bold: true, color: { argb: hexToArgb(entry.eventColor) } },
      text: `${entry.eventTitle}\n`,
    });
    for (const tg of entry.timeGroups) {
      chunk(tg.names, 5).forEach((row, rowIdx) => {
        const prefix = rowIdx === 0 ? `${tg.time} ` : "";
        runs.push({ text: `${prefix}${row.join(" ")}\n` });
      });
    }
  });
  return runs;
}

/** 화면에 그려진 승인 달력과 동일한 구조(7열 × 주 단위, 이벤트명 색상,
 * 시간별 이름 1행5열 줄바꿈)로 xlsx를 생성해 다운로드한다. */
export async function exportApprovalCalendarXlsx(
  month: Date,
  days: Map<string, ApprovalCalendarDay>,
): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  const monthLabel = `${month.getFullYear()}년 ${month.getMonth() + 1}월`;
  const sheet = workbook.addWorksheet(monthLabel, {
    views: [{ showGridLines: false }],
  });

  sheet.columns = WEEKDAYS.map(() => ({ width: 26 }));

  const headerRow = sheet.addRow(WEEKDAYS);
  headerRow.eachCell((cell) => {
    cell.font = { bold: true };
    cell.alignment = { horizontal: "center", vertical: "middle" };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFEEF0F3" },
    };
    cell.border = {
      top: { style: "thin" },
      bottom: { style: "thin" },
      left: { style: "thin" },
      right: { style: "thin" },
    };
  });

  const weeks = buildCalendarWeeks(month);
  for (const week of weeks) {
    const dateRow = sheet.addRow(
      week.map((ymd) => (ymd ? Number(ymd.slice(-2)) : "")),
    );
    dateRow.eachCell((cell) => {
      cell.font = { bold: true };
      cell.alignment = { horizontal: "center" };
      cell.border = {
        top: { style: "thin" },
        left: { style: "thin" },
        right: { style: "thin" },
      };
    });

    const contentRow = sheet.addRow(
      week.map((ymd) => (ymd ? { richText: buildCellRichText(days.get(ymd)) } : "")),
    );
    contentRow.height = 150;
    contentRow.eachCell((cell) => {
      cell.alignment = { horizontal: "center", vertical: "top", wrapText: true };
      cell.border = {
        bottom: { style: "thin" },
        left: { style: "thin" },
        right: { style: "thin" },
      };
    });
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `han-ops-승인달력-${month.getFullYear()}${String(month.getMonth() + 1).padStart(2, "0")}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}
