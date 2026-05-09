export type ApplicationStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "completed";

export type ApplicationItem = {
  id: string;
  userId?: string;
  eventId?: string;
  sessionId?: string;
  slotId?: string;
  eventTitle: string;
  venue: string;
  slotTime: string;
  date: string;
  status: ApplicationStatus;
  /** ISO 문자열 */
  submittedAt: string;
  note?: string;
};

export const statusLabels: Record<ApplicationStatus, string> = {
  pending: "대기 중",
  approved: "승인 완료",
  rejected: "거절됨",
  completed: "완료됨",
};
