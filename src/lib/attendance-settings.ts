import {
  DEFAULT_ATTENDANCE_SETTINGS,
  type AttendanceSettings,
  type OutsideRadiusPolicy,
} from "@/types/attendance";

function asBool(v: unknown, fallback: boolean): boolean {
  return typeof v === "boolean" ? v : fallback;
}

function asNum(v: unknown, fallback: number): number {
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}

function asStr(v: unknown, fallback = ""): string {
  return typeof v === "string" ? v : fallback;
}

function asNullableNum(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function asPolicy(v: unknown): OutsideRadiusPolicy {
  if (v === "block" || v === "allow_with_warning" || v === "ignore_gps") {
    return v;
  }
  return DEFAULT_ATTENDANCE_SETTINGS.outsideRadiusPolicy;
}

export function parseAttendanceSettings(
  raw: unknown,
): AttendanceSettings {
  if (!raw || typeof raw !== "object") {
    return { ...DEFAULT_ATTENDANCE_SETTINGS };
  }
  const d = raw as Record<string, unknown>;
  return {
    attendanceEnabled: asBool(
      d.attendanceEnabled,
      DEFAULT_ATTENDANCE_SETTINGS.attendanceEnabled,
    ),
    photoRequired: asBool(
      d.photoRequired,
      DEFAULT_ATTENDANCE_SETTINGS.photoRequired,
    ),
    locationVerificationEnabled: asBool(
      d.locationVerificationEnabled,
      DEFAULT_ATTENDANCE_SETTINGS.locationVerificationEnabled,
    ),
    checkInOpenMinutesBefore: asNum(
      d.checkInOpenMinutesBefore,
      DEFAULT_ATTENDANCE_SETTINGS.checkInOpenMinutesBefore,
    ),
    checkInCloseMinutesAfter: asNum(
      d.checkInCloseMinutesAfter,
      DEFAULT_ATTENDANCE_SETTINGS.checkInCloseMinutesAfter,
    ),
    venueName: asStr(d.venueName),
    venueAddress: asStr(d.venueAddress),
    venueLatitude: asNullableNum(d.venueLatitude),
    venueLongitude: asNullableNum(d.venueLongitude),
    allowedRadiusMeters: asNum(
      d.allowedRadiusMeters,
      DEFAULT_ATTENDANCE_SETTINGS.allowedRadiusMeters,
    ),
    outsideRadiusPolicy: asPolicy(d.outsideRadiusPolicy),
    lateGraceMinutes: asNum(
      d.lateGraceMinutes,
      DEFAULT_ATTENDANCE_SETTINGS.lateGraceMinutes,
    ),
  };
}

export function serializeAttendanceSettings(
  settings: AttendanceSettings,
): AttendanceSettings {
  return {
    attendanceEnabled: Boolean(settings.attendanceEnabled),
    photoRequired: Boolean(settings.photoRequired),
    locationVerificationEnabled: Boolean(settings.locationVerificationEnabled),
    checkInOpenMinutesBefore: Math.max(
      0,
      Math.round(settings.checkInOpenMinutesBefore),
    ),
    checkInCloseMinutesAfter: Math.max(
      0,
      Math.round(settings.checkInCloseMinutesAfter),
    ),
    venueName: settings.venueName.trim(),
    venueAddress: settings.venueAddress.trim(),
    venueLatitude: settings.venueLatitude,
    venueLongitude: settings.venueLongitude,
    allowedRadiusMeters: Math.max(10, Math.round(settings.allowedRadiusMeters)),
    outsideRadiusPolicy: settings.outsideRadiusPolicy,
    lateGraceMinutes: Math.max(0, Math.round(settings.lateGraceMinutes)),
  };
}
