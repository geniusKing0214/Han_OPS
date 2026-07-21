import type { WorkStatus } from "@/types/points";
import type { TeamId } from "@/types/team";

export type ApplicationStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "completed";

export type ApplicationItem = {
  id: string;
  userId?: string;
  /** 프로필/구글 닉네임(설정 시). 없으면 UI에서 이메일로 대체 표시 */
  applicantDisplayName?: string;
  applicantEmail?: string;
  eventId?: string;
  sessionId?: string;
  slotId?: string;
  /** 신청자 소속 팀 (없으면 team_1) */
  team_id?: TeamId;
  eventTitle: string;
  venue: string;
  slotTime: string;
  date: string;
  status: ApplicationStatus;
  /** ISO 문자열 */
  submittedAt: string;
  /** 신청자 메모 */
  note?: string;
  /** 거절 시 관리자 사유 */
  rejectionReason?: string;
  /** 관리자 메모 (선택) */
  adminMemo?: string;
  workStatus?: WorkStatus;
  pointsAwarded?: boolean;
  completedAt?: string;
  completedByAdmin?: string;
  /** 신청 포지션 ID (e.g. "dealer") */
  positionId?: string;
  /** 신청 포지션 라벨 스냅샷 (e.g. "딜러") */
  positionLabel?: string;
  /** Option B: 포지션 내 시간 슬롯 ID */
  positionSlotId?: string;
  /** Option B: 포지션 슬롯 시간 스냅샷 (e.g. "09:00") */
  positionSlotTime?: string;
};

export const statusLabels: Record<ApplicationStatus, string> = {
  pending: "대기 중",
  approved: "승인 완료",
  rejected: "거절됨",
  completed: "완료됨",
};
