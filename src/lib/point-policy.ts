import type { WorkStatus } from "@/types/points";
import { POINT_POLICY } from "@/types/points";

/** 근무 상태에 따른 포인트 (not_checked = 0) */
export function pointsForWorkStatus(status: WorkStatus): number {
  if (status === "completed") return POINT_POLICY.completed;
  if (status === "no_show") return POINT_POLICY.no_show;
  if (status === "late_cancel") return POINT_POLICY.late_cancel;
  return 0;
}

export function monthKeyFromDateYmd(dateYmd: string): string {
  if (dateYmd.length >= 7) return dateYmd.slice(0, 7);
  const d = new Date();
  const y = d.getFullYear();
  const m = `${d.getMonth() + 1}`.padStart(2, "0");
  return `${y}-${m}`;
}

export function monthKeyFromIso(iso: string): string {
  try {
    const d = new Date(iso);
    const y = d.getFullYear();
    const m = `${d.getMonth() + 1}`.padStart(2, "0");
    return `${y}-${m}`;
  } catch {
    return monthKeyFromDateYmd("");
  }
}
