export type ApplicationStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "completed";

export type ApplicationItem = {
  id: string;
  userId?: string;
  /** 신청 시점 표시명(관리자 목록용) */
  applicantDisplayName?: string;
  applicantEmail?: string;
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
