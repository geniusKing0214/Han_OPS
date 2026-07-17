import type { AttendanceSettings } from "@/types/attendance";
import type { TeamId } from "@/types/team";

export type Slot = {
  id: string;
  start_time: string;
  capacity: number;
  applied_count: number;
};

export type Session = {
  id: string;
  date: string;
  slots: Slot[];
};

export type EventItem = {
  id: string;
  title: string;
  venue: string;
  /** 노출 팀 (없으면 team_1) */
  team_ids?: TeamId[];
  /** 생성 시각 (ISO). 1팀 등록 시 2팀 자동 오픈 기준 */
  createdAt?: string;
  /**
   * 1팀만 등록한 일정에서 2팀 신청이 열리는 시각 (ISO).
   * 있으면 해당 시각 이후 2팀도 일정 확인·신청 가능.
   */
  team2ApplyOpensAt?: string;
  /** 이벤트 특이사항(선택) */
  notice?: string;
  /** UI 강조용 hex 등 (선택) */
  color?: string;
  /** 이벤트별 출근 인증 설정 (기본: 비활성) */
  attendance?: AttendanceSettings;
  sessions: Session[];
};

