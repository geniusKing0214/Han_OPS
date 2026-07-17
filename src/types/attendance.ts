import type { TeamId } from "@/types/team";

export type OutsideRadiusPolicy =
  | "block"
  | "allow_with_warning"
  | "ignore_gps";

export type AttendanceTimeStatus =
  | "normal"
  | "late"
  | "very_late"
  | "admin_modified";

export type AttendanceLocationStatus =
  | "inside_radius"
  | "outside_radius"
  | "location_unavailable"
  | "low_accuracy"
  | "not_required";

export type AttendanceReviewStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "none";

export type AttendancePhotoStatus =
  | "active"
  | "scheduled_for_deletion"
  | "deleted"
  | "deletion_failed"
  | "none";

/** 이벤트/스케줄별 출근 인증 설정 */
export type AttendanceSettings = {
  attendanceEnabled: boolean;
  photoRequired: boolean;
  locationVerificationEnabled: boolean;
  checkInOpenMinutesBefore: number;
  checkInCloseMinutesAfter: number;
  venueName: string;
  venueAddress: string;
  venueLatitude: number | null;
  venueLongitude: number | null;
  allowedRadiusMeters: number;
  outsideRadiusPolicy: OutsideRadiusPolicy;
  lateGraceMinutes: number;
};

export const DEFAULT_ATTENDANCE_SETTINGS: AttendanceSettings = {
  attendanceEnabled: false,
  photoRequired: true,
  locationVerificationEnabled: true,
  checkInOpenMinutesBefore: 60,
  checkInCloseMinutesAfter: 120,
  venueName: "",
  venueAddress: "",
  venueLatitude: null,
  venueLongitude: null,
  allowedRadiusMeters: 150,
  outsideRadiusPolicy: "allow_with_warning",
  lateGraceMinutes: 10,
};

export type AttendanceRecord = {
  id: string;
  userId: string;
  userName: string;
  teamId: TeamId;
  applicationId: string;
  eventId: string;
  eventName: string;
  workDate: string;
  slotTime: string;
  venue: string;
  scheduledCheckInAt: string;
  actualCheckInAt: string;
  latitude: number | null;
  longitude: number | null;
  accuracy: number | null;
  venueLatitude: number | null;
  venueLongitude: number | null;
  distanceFromVenueMeters: number | null;
  timeStatus: AttendanceTimeStatus;
  locationStatus: AttendanceLocationStatus;
  photoUrl: string | null;
  storagePath: string | null;
  reviewStatus: AttendanceReviewStatus;
  reviewedBy: string | null;
  reviewedAt: string | null;
  adminMemo: string;
  rejectionReason: string | null;
  photoDeleteAt: string | null;
  photoDeletedAt: string | null;
  photoStatus: AttendancePhotoStatus;
  photoDeletionError: string | null;
  photoDeletionRetryCount: number;
  /** 재인증 시 이전 기록 id */
  previousAttendanceId: string | null;
  attempt: number;
  createdAt: string;
  updatedAt: string;
  // ── 서버사이드 GPS 검증 (Cloud Function이 채움) ──
  gpsVerified?: boolean;
  serverDistanceMeters?: number | null;
  gpsSuspicious?: boolean;
  gpsSuspiciousReasons?: string[] | null;
  // ── Mock Location 감지 결과 (클라이언트가 채움) ──
  mockLocationRiskLevel?: "none" | "low" | "medium" | "high" | null;
  mockLocationReasons?: string[] | null;
};

export const TIME_STATUS_LABELS: Record<AttendanceTimeStatus, string> = {
  normal: "정상 출근",
  late: "지각",
  very_late: "심한 지각",
  admin_modified: "관리자 수정",
};

export const LOCATION_STATUS_LABELS: Record<AttendanceLocationStatus, string> = {
  inside_radius: "위치 정상",
  outside_radius: "위치 확인 필요",
  location_unavailable: "위치 없음",
  low_accuracy: "위치 정확도 낮음",
  not_required: "GPS 미사용",
};

export const REVIEW_STATUS_LABELS: Record<AttendanceReviewStatus, string> = {
  none: "해당 없음",
  pending: "관리자 확인 대기",
  approved: "확인 완료",
  rejected: "재인증 필요",
};

export const PHOTO_STATUS_LABELS: Record<AttendancePhotoStatus, string> = {
  none: "사진 없음",
  active: "사진 보관 중",
  scheduled_for_deletion: "사진 삭제 예정",
  deleted: "사진 삭제 완료",
  deletion_failed: "사진 삭제 실패",
};

export const REJECTION_REASONS = [
  "사진 확인 불가",
  "본인 확인 불가",
  "잘못된 장소",
  "위치 확인 불가",
  "잘못된 일정",
  "중복 인증",
  "기타",
] as const;
