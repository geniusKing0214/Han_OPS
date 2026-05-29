export type WorkStatus = "not_checked" | "completed" | "no_show" | "late_cancel";

export type PointType = "completed" | "no_show" | "late_cancel" | "adjustment";

export type PointLogDoc = {
  id: string;
  user_id: string;
  application_id: string;
  point_type: PointType;
  points: number;
  reason: string;
  created_by_admin: string;
  created_at: string;
  month_key: string;
};

export const WORK_STATUS_LABELS: Record<WorkStatus, string> = {
  not_checked: "미확인",
  completed: "근무완료",
  no_show: "결근",
  late_cancel: "당일취소",
};

export const POINT_POLICY = {
  completed: 10,
  no_show: -10,
  late_cancel: -5,
} as const;

export const POINT_TYPE_LABELS: Record<PointType, string> = {
  completed: "근무완료",
  no_show: "결근",
  late_cancel: "당일취소",
  adjustment: "관리자 조정",
};
