import ExcelJS from "exceljs";

import type { ListedUserRow } from "@/lib/firestore-users";
import { TEAM_LABELS, normalizeTeamId } from "@/types/team";

const HEADER_FILL = "FFEEF0F3";

const APPROVAL_LABELS: Record<string, string> = {
  pending: "승인 대기",
  approved: "승인됨",
  rejected: "거절됨",
};

/** 회원관리 목록(이름·이메일·연락처)을 xlsx로 내보낸다. */
export async function exportMemberDirectoryXlsx(
  rows: ListedUserRow[],
): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("회원관리", {
    views: [{ showGridLines: false }],
  });

  sheet.columns = [
    { header: "이름", key: "name", width: 16 },
    { header: "이메일", key: "email", width: 30 },
    { header: "연락처", key: "phone", width: 18 },
    { header: "팀", key: "team", width: 10 },
    { header: "역할", key: "role", width: 10 },
    { header: "승인 상태", key: "status", width: 12 },
  ];

  const headerRow = sheet.getRow(1);
  headerRow.eachCell((cell) => {
    cell.font = { bold: true };
    cell.alignment = { horizontal: "center", vertical: "middle" };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: HEADER_FILL } };
    cell.border = {
      top: { style: "thin" },
      bottom: { style: "thin" },
      left: { style: "thin" },
      right: { style: "thin" },
    };
  });

  for (const row of rows) {
    sheet.addRow({
      name: row.displayName?.trim() || "—",
      email: row.email,
      phone: row.phone?.trim() || "—",
      team: TEAM_LABELS[normalizeTeamId(row.team_id)],
      role: row.role === "admin" ? "관리자" : "일반",
      status: APPROVAL_LABELS[row.accountStatus ?? ""] ?? "—",
    });
  }

  sheet.eachRow((row) => {
    row.eachCell((cell) => {
      cell.border = {
        ...cell.border,
        left: { style: "thin" },
        right: { style: "thin" },
      };
    });
  });

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const today = new Date();
  const stamp = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, "0")}${String(today.getDate()).padStart(2, "0")}`;
  a.download = `han-ops-회원관리-${stamp}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}
