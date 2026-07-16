import type { TeamId } from "@/types/team";

/** 월=0 … 일=6 (주간 달력 기준) */
export type WeekdayKey =
  | "mon"
  | "tue"
  | "wed"
  | "thu"
  | "fri"
  | "sat"
  | "sun";

export const WEEKDAY_KEYS: WeekdayKey[] = [
  "mon",
  "tue",
  "wed",
  "thu",
  "fri",
  "sat",
  "sun",
];

export const WEEKDAY_LABELS: Record<WeekdayKey, string> = {
  mon: "월",
  tue: "화",
  wed: "수",
  thu: "목",
  fri: "금",
  sat: "토",
  sun: "일",
};

export const WEEKDAY_SHORT: Record<WeekdayKey, string> = {
  mon: "M",
  tue: "T",
  wed: "W",
  thu: "T",
  fri: "F",
  sat: "S",
  sun: "S",
};

export type WorkforceAssignStatus = "draft" | "confirmed" | "cancelled";

export type WorkforceWorkerStatus =
  | "available"
  | "partial"
  | "full"
  | "unavailable"
  | "leave";

export const WORKFORCE_WORKER_STATUS_LABELS: Record<
  WorkforceWorkerStatus,
  string
> = {
  available: "배정 가능",
  partial: "일부 가능",
  full: "배정 완료",
  unavailable: "배정 불가",
  leave: "휴무",
};

export const DEFAULT_WEEKLY_MAX = 5;

export const DEFAULT_AVAILABLE_WEEKDAYS: Record<WeekdayKey, boolean> = {
  mon: true,
  tue: true,
  wed: true,
  thu: true,
  fri: true,
  sat: false,
  sun: false,
};

export const WORKFORCE_COLORS = [
  "#F59E0B",
  "#3B82F6",
  "#10B981",
  "#EF4444",
  "#8B5CF6",
  "#EC4899",
  "#06B6D4",
  "#C8A96B",
] as const;

export type WorkforceWeekMeta = {
  weekStart: string;
  status: WorkforceAssignStatus;
  confirmedAt?: string;
  confirmedBy?: string;
  updatedAt: string;
  updatedBy: string;
};

export type WorkforceSchedule = {
  id: string;
  weekStart: string;
  date: string;
  title: string;
  startTime: string;
  venue: string;
  requiredCount: number;
  teamIds: TeamId[];
  note: string;
  color: string;
  assignedUserIds: string[];
  status: WorkforceAssignStatus;
  /** 기존 events 스케줄과 연동 시 */
  sourceEventId?: string;
  sourceSessionId?: string;
  sourceSlotId?: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
};

export type WorkforceAvailability = {
  userId: string;
  weeklyMaxAssignments: number;
  availableWeekdays: Record<WeekdayKey, boolean>;
  /** YYYY-MM-DD → available | unavailable */
  dateExceptions: Record<string, "available" | "unavailable">;
  updatedAt: string;
};

export type WorkforceLogAction =
  | "create_schedule"
  | "update_schedule"
  | "delete_schedule"
  | "duplicate_schedule"
  | "assign"
  | "unassign"
  | "move"
  | "confirm_week"
  | "reset_week"
  | "save_draft"
  | "export_monthly"
  | "update_availability"
  | "import_events";

export type WorkforceAssignmentLog = {
  id: string;
  weekStart: string;
  scheduleId?: string;
  actorUserId: string;
  actorName: string;
  action: WorkforceLogAction;
  targetUserId?: string;
  targetUserName?: string;
  detail?: string;
  reason?: string;
  createdAt: string;
};

export type WorkforceMonthlyExportRow = {
  userId: string;
  userName: string;
  teamId: TeamId;
  date: string;
  title: string;
  startTime: string;
  venue: string;
  note: string;
  status: WorkforceAssignStatus;
};

export type WorkforceMonthlyExport = {
  id: string;
  yearMonth: string;
  weekStart: string;
  exportedAt: string;
  exportedBy: string;
  rows: WorkforceMonthlyExportRow[];
};
