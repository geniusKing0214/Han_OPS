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
  /** 이벤트 특이사항(선택) */
  notice?: string;
  /** UI 강조용 hex 등 (선택) */
  color?: string;
  sessions: Session[];
};
