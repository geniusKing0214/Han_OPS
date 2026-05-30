import type { TeamId } from "@/types/team";

export type UserRole = "admin" | "member";
export type UserApprovalStatus = "pending" | "approved" | "rejected";

/** Firestore `users/{uid}` document shape used by this app */
export type UserProfileDoc = {
  email: string;
  role: UserRole;
  /** 가입 승인 상태 (기존 문서는 없을 수 있음) */
  accountStatus?: UserApprovalStatus;
  /** 소속 팀 (기존 문서는 없을 수 있음 → team_1) */
  team_id?: TeamId;
  /** Firestore Timestamp at runtime */
  createdAt?: unknown;
  /** 사용자 지정 표시 이름 */
  displayName?: string;
  /** 연락처(전화 등) */
  phone?: string;
  /** 누적 포인트 */
  total_points?: number;
};
