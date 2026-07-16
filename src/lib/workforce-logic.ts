import {
  DEFAULT_WEEKLY_MAX,
  type WorkforceAvailability,
  type WorkforceSchedule,
  type WorkforceWorkerStatus,
} from "@/types/workforce";
import { weekdayKeyFromYmd } from "@/lib/workforce-dates";
import { defaultAvailability } from "@/lib/firestore-workforce";

export function resolveAvailability(
  map: Map<string, WorkforceAvailability>,
  userId: string,
): WorkforceAvailability {
  return map.get(userId) ?? defaultAvailability(userId);
}

export function isUserAvailableOnDate(
  avail: WorkforceAvailability,
  dateYmd: string,
): boolean {
  const exception = avail.dateExceptions[dateYmd];
  if (exception === "unavailable") return false;
  if (exception === "available") return true;
  const key = weekdayKeyFromYmd(dateYmd);
  return avail.availableWeekdays[key] === true;
}

export function countAssignmentsInWeek(
  schedules: WorkforceSchedule[],
  userId: string,
): number {
  return schedules.filter((s) => s.assignedUserIds.includes(userId)).length;
}

export function findSameDayAssignment(
  schedules: WorkforceSchedule[],
  userId: string,
  dateYmd: string,
  excludeScheduleId?: string,
): WorkforceSchedule | undefined {
  return schedules.find(
    (s) =>
      s.id !== excludeScheduleId &&
      s.date === dateYmd &&
      s.assignedUserIds.includes(userId),
  );
}

export function computeWorkerStatus(
  avail: WorkforceAvailability,
  weekDates: string[],
  assignmentCount: number,
): WorkforceWorkerStatus {
  const availableDays = weekDates.filter((d) =>
    isUserAvailableOnDate(avail, d),
  ).length;
  if (availableDays === 0) return "leave";
  const max = avail.weeklyMaxAssignments || DEFAULT_WEEKLY_MAX;
  if (assignmentCount >= max) return "full";
  if (availableDays < weekDates.length) return "partial";
  if (assignmentCount === 0) return "available";
  return "partial";
}

export function summarizeWeek(schedules: WorkforceSchedule[]) {
  let required = 0;
  let assigned = 0;
  let shortage = 0;
  let excess = 0;
  for (const s of schedules) {
    required += s.requiredCount;
    const n = s.assignedUserIds.length;
    assigned += n;
    if (n < s.requiredCount) shortage += s.requiredCount - n;
    if (n > s.requiredCount) excess += n - s.requiredCount;
  }
  return { required, assigned, shortage, excess };
}

export function findDuplicateSameDayPairs(schedules: WorkforceSchedule[]) {
  const hits: { userId: string; date: string; scheduleIds: string[] }[] = [];
  const byDateUser = new Map<string, string[]>();
  for (const s of schedules) {
    for (const uid of s.assignedUserIds) {
      const key = `${s.date}:${uid}`;
      const list = byDateUser.get(key) ?? [];
      list.push(s.id);
      byDateUser.set(key, list);
    }
  }
  for (const [key, ids] of byDateUser) {
    if (ids.length < 2) continue;
    const [date, userId] = key.split(":");
    hits.push({ userId: userId!, date: date!, scheduleIds: ids });
  }
  return hits;
}

export function findUnavailableAssignments(
  schedules: WorkforceSchedule[],
  availMap: Map<string, WorkforceAvailability>,
) {
  const hits: { userId: string; scheduleId: string; date: string }[] = [];
  for (const s of schedules) {
    for (const uid of s.assignedUserIds) {
      const avail = resolveAvailability(availMap, uid);
      if (!isUserAvailableOnDate(avail, s.date)) {
        hits.push({ userId: uid, scheduleId: s.id, date: s.date });
      }
    }
  }
  return hits;
}
