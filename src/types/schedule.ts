import type { TeamId } from "@/types/team";

/** 포지션 내 시간 슬롯 (Option B) */
export type PositionSlot = {
  id: string;
  time: string;          // e.g. "09:00"
  capacity: number;
  applied_count: number;
  /** true면 time을 비워두고 "시간 미정"으로 표시 — 인원만 확정하고 시간은 나중에 정할 때 사용 */
  timeUndetermined?: boolean;
};

/** 포지션 정의 (어드민이 이벤트별로 커스터마이즈) */
export type PositionDef = {
  id: string;    // e.g. "dealer", "floor", "reg", "chips"
  label: string; // e.g. "딜러", "플로어", "레지", "칩스"
  capacity: number; // 단순 정원 (slots 미사용 시)
  slots: PositionSlot[]; // 시간별 정원 (Option B)
};

export const DEFAULT_POSITIONS: PositionDef[] = [
  { id: "dealer", label: "딜러", capacity: 0, slots: [] },
  { id: "floor",  label: "플로어", capacity: 0, slots: [] },
  { id: "reg",    label: "레지", capacity: 0, slots: [] },
  { id: "chips",  label: "칩스", capacity: 0, slots: [] },
];

export type Slot = {
  id: string;
  start_time: string;
  capacity: number;
  applied_count: number;
  /** true면 start_time을 비워두고 "시간 미정"으로 표시 — 인원만 확정하고 시간은 나중에 정할 때 사용 */
  timeUndetermined?: boolean;
};

/** 시간 문자열 표시용 — timeUndetermined면 "시간 미정", 아니면 원래 시간(없으면 대시) */
export function formatSlotTime(
  time: string | undefined,
  timeUndetermined?: boolean,
): string {
  if (timeUndetermined) return "시간 미정";
  return time?.trim() || "—";
}

export type Session = {
  id: string;
  date: string;
  slots: Slot[];
  /** 연속 일정 묶음 ID — 같은 groupId 끼리 하나의 신청으로 처리 */
  groupId?: string;
  /**
   * 포지션 슬롯(Option B) 정원 카운트 — 날짜(세션)별로 독립 관리한다.
   * key: `${positionId}::${positionSlotId}` (positionSlotKey 참고),
   * value: 해당 세션에서 승인/완료된 신청 수.
   * event.positions[].slots[].capacity/time 등 "정의"는 이벤트 레벨에서 공유하지만,
   * 실제 인원 카운트는 날짜마다 달라야 하므로 여기서 별도로 추적한다.
   */
  positionSlotCounts?: Record<string, number>;
  /**
   * 포지션 슬롯 시간 오버라이드 — 날짜(세션)별로 이벤트 레벨 기본 시간과
   * 다르게 쓰고 싶을 때 사용한다. key: positionSlotKey 참고, value: "HH:mm".
   * 지정하지 않은 세션은 event.positions[].slots[].time(기본값)을 그대로 쓴다.
   */
  positionSlotTimeOverrides?: Record<string, string>;
};

export function positionSlotKey(positionId: string, positionSlotId: string): string {
  return `${positionId}::${positionSlotId}`;
}

/**
 * event.positions(포지션 정의는 이벤트 레벨 공유)에 이 세션(날짜)의 실제 정원
 * 카운트(session.positionSlotCounts)와 시간 오버라이드
 * (session.positionSlotTimeOverrides)를 덮어써서 반환한다. 아직 이 세션이
 * 한 번도 승인/취소를 거치지 않아 카운트가 시드되지 않았다면, 예전 방식인
 * 이벤트 전체 공유 카운트(slot.applied_count)로 폴백한다 — 최소한 지금보다
 * 나빠지지는 않는다.
 *
 * 정원 마감 여부를 판단하는 모든 화면은 반드시 이 함수를 거친 PositionDef를
 * 써야 한다 — event.positions를 그대로 쓰면 slot.applied_count가 세션별로
 * 갱신되지 않아 항상 0으로 보여 마감된 슬롯도 계속 신청을 받게 된다.
 */
export function sessionAwarePositions(
  positions: PositionDef[] | undefined,
  session: Session,
): PositionDef[] {
  if (!positions?.length) return positions ?? [];
  return positions.map((pos) => ({
    ...pos,
    slots: pos.slots.map((slot) => {
      const key = positionSlotKey(pos.id, slot.id);
      const seededCount = session.positionSlotCounts?.[key];
      const timeOverride = session.positionSlotTimeOverrides?.[key];
      return {
        ...slot,
        ...(seededCount === undefined ? {} : { applied_count: seededCount }),
        ...(timeOverride ? { time: timeOverride } : {}),
      };
    }),
  }));
}

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
  sessions: Session[];
  /** 포지션 사용 여부 (어드민이 이벤트 생성 시 활성화) */
  usePositions?: boolean;
  /** 포지션 목록 (usePositions=true 일 때만 유효) */
  positions?: PositionDef[];
  /** 마감 처리 여부 — true 이면 신청 불가 */
  closed?: boolean;
  /** 신청 잠금 — true 이면 어드민이 수동으로 신청을 잠근 상태 (아직 오픈 안 함) */
  locked?: boolean;
  /**
   * 상시 신청 허용 — true 이면 정규 신청기간(신청전/신청마감/신청불가)과
   * 무관하게 항상 신청 가능 상태로 취급한다. 어드민이 중요 일정에 대해
   * 신청기간이 아니어도 신청을 받고 싶을 때 수동으로 켠다.
   */
  forceApplyOpen?: boolean;
  /**
   * 기간 패키지 목록 — 관리자가 정의한 신청 가능 기간 옵션
   * (예: "5일" = 8/1~8/5, "7일" = 8/1~8/7, "전체" = 8/1~8/10)
   * packages가 있으면 슬롯/포지션 대신 패키지 선택으로 신청
   */
  packages?: EventPackage[];
};

/** 기간 패키지 (10일 이벤트에서 5일/7일/전체 등 기간 옵션) */
export type EventPackage = {
  id: string;
  label: string;     // "5일", "7일", "전체"
  startDate: string; // "2026-08-01"
  endDate: string;   // "2026-08-05"
};

