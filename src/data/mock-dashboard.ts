/** 대시보드 상단 지표 — 백엔드 연동 전까지 0으로 표시 */
export const dashboardStats = {
  todayShiftCount: 0,
  pendingApprovals: 0,
  openSlots: 0,
  monthWorked: 0,
};

export const todayShifts: {
  id: string;
  title: string;
  time: string;
  venue: string;
  status: "confirmed" | "pending";
}[] = [];
