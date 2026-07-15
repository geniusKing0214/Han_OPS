import type {
  AttendanceLocationStatus,
  AttendanceSettings,
  AttendanceTimeStatus,
} from "@/types/attendance";

/** workDate YYYY-MM-DD + slotTime HH:mm → local Date */
export function scheduledCheckInDate(workDate: string, slotTime: string): Date {
  const [y, m, d] = workDate.split("-").map(Number);
  const [hh, mm] = slotTime.split(":").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1, hh ?? 0, mm ?? 0, 0, 0);
}

export function isWorkDateToday(workDate: string, now = new Date()): boolean {
  const y = now.getFullYear();
  const m = `${now.getMonth() + 1}`.padStart(2, "0");
  const d = `${now.getDate()}`.padStart(2, "0");
  return workDate === `${y}-${m}-${d}`;
}

export function getCheckInWindow(
  settings: AttendanceSettings,
  workDate: string,
  slotTime: string,
) {
  const scheduled = scheduledCheckInDate(workDate, slotTime);
  const openAt = new Date(
    scheduled.getTime() - settings.checkInOpenMinutesBefore * 60_000,
  );
  const closeAt = new Date(
    scheduled.getTime() + settings.checkInCloseMinutesAfter * 60_000,
  );
  return { scheduled, openAt, closeAt };
}

export function isWithinCheckInWindow(
  settings: AttendanceSettings,
  workDate: string,
  slotTime: string,
  now = new Date(),
): boolean {
  if (!isWorkDateToday(workDate, now)) return false;
  const { openAt, closeAt } = getCheckInWindow(settings, workDate, slotTime);
  return now.getTime() >= openAt.getTime() && now.getTime() <= closeAt.getTime();
}

export function computeTimeStatus(
  settings: AttendanceSettings,
  workDate: string,
  slotTime: string,
  actualAt: Date,
): AttendanceTimeStatus {
  const scheduled = scheduledCheckInDate(workDate, slotTime);
  const graceMs = settings.lateGraceMinutes * 60_000;
  const lateBoundary = scheduled.getTime() + graceMs;
  const veryLateBoundary = scheduled.getTime() + graceMs + 60 * 60_000;
  if (actualAt.getTime() <= lateBoundary) return "normal";
  if (actualAt.getTime() <= veryLateBoundary) return "late";
  return "very_late";
}

export function computeLocationStatus(input: {
  settings: AttendanceSettings;
  latitude: number | null;
  longitude: number | null;
  accuracy: number | null;
  distanceMeters: number | null;
}): AttendanceLocationStatus {
  const { settings, latitude, longitude, accuracy, distanceMeters } = input;
  if (!settings.locationVerificationEnabled) return "not_required";
  if (
    settings.outsideRadiusPolicy === "ignore_gps" ||
    settings.venueLatitude == null ||
    settings.venueLongitude == null
  ) {
    return "not_required";
  }
  if (latitude == null || longitude == null || distanceMeters == null) {
    return "location_unavailable";
  }
  if (
    accuracy != null &&
    accuracy > Math.max(settings.allowedRadiusMeters * 2, 100)
  ) {
    return "low_accuracy";
  }
  if (distanceMeters <= settings.allowedRadiusMeters) return "inside_radius";
  return "outside_radius";
}

export function formatAttendanceDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString("ko-KR", {
      month: "numeric",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso.slice(0, 16).replace("T", " ");
  }
}
