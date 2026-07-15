"use client";

import { Input } from "@/components/ui/input";
import {
  DEFAULT_ATTENDANCE_SETTINGS,
  type AttendanceSettings,
  type OutsideRadiusPolicy,
} from "@/types/attendance";

export function EventAttendanceSettingsFields({
  value,
  onChange,
}: {
  value: AttendanceSettings;
  onChange: (next: AttendanceSettings) => void;
}) {
  const v = value ?? DEFAULT_ATTENDANCE_SETTINGS;
  const set = <K extends keyof AttendanceSettings>(
    key: K,
    next: AttendanceSettings[K],
  ) => onChange({ ...v, [key]: next });

  return (
    <div className="space-y-3 rounded-lg border border-border bg-muted/20 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">출근 인증 설정</p>
          <p className="text-xs text-muted-foreground">
            이벤트별로 설정합니다. 기본값은 비활성입니다.
          </p>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={v.attendanceEnabled}
            onChange={(e) => set("attendanceEnabled", e.target.checked)}
          />
          출근 인증 사용
        </label>
      </div>

      {v.attendanceEnabled ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="space-y-1 text-xs">
            <span className="text-muted-foreground">인증 가능 시작 (분 전)</span>
            <Input
              type="number"
              min={0}
              value={v.checkInOpenMinutesBefore}
              onChange={(e) =>
                set("checkInOpenMinutesBefore", Number(e.target.value) || 0)
              }
            />
          </label>
          <label className="space-y-1 text-xs">
            <span className="text-muted-foreground">인증 가능 종료 (분 후)</span>
            <Input
              type="number"
              min={0}
              value={v.checkInCloseMinutesAfter}
              onChange={(e) =>
                set("checkInCloseMinutesAfter", Number(e.target.value) || 0)
              }
            />
          </label>
          <label className="flex items-center gap-2 text-sm sm:col-span-1">
            <input
              type="checkbox"
              checked={v.photoRequired}
              onChange={(e) => set("photoRequired", e.target.checked)}
            />
            인증 사진 필수
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={v.locationVerificationEnabled}
              onChange={(e) =>
                set("locationVerificationEnabled", e.target.checked)
              }
            />
            GPS 위치 확인
          </label>
          <label className="space-y-1 text-xs sm:col-span-2">
            <span className="text-muted-foreground">장소명</span>
            <Input
              value={v.venueName}
              onChange={(e) => set("venueName", e.target.value)}
              placeholder="파라다이스시티"
            />
          </label>
          <label className="space-y-1 text-xs sm:col-span-2">
            <span className="text-muted-foreground">주소</span>
            <Input
              value={v.venueAddress}
              onChange={(e) => set("venueAddress", e.target.value)}
            />
          </label>
          <label className="space-y-1 text-xs">
            <span className="text-muted-foreground">위도</span>
            <Input
              type="number"
              step="any"
              value={v.venueLatitude ?? ""}
              onChange={(e) =>
                set(
                  "venueLatitude",
                  e.target.value === "" ? null : Number(e.target.value),
                )
              }
            />
          </label>
          <label className="space-y-1 text-xs">
            <span className="text-muted-foreground">경도</span>
            <Input
              type="number"
              step="any"
              value={v.venueLongitude ?? ""}
              onChange={(e) =>
                set(
                  "venueLongitude",
                  e.target.value === "" ? null : Number(e.target.value),
                )
              }
            />
          </label>
          <label className="space-y-1 text-xs">
            <span className="text-muted-foreground">허용 반경 (m)</span>
            <Input
              type="number"
              min={10}
              value={v.allowedRadiusMeters}
              onChange={(e) =>
                set("allowedRadiusMeters", Number(e.target.value) || 150)
              }
            />
          </label>
          <label className="space-y-1 text-xs">
            <span className="text-muted-foreground">지각 허용 (분)</span>
            <Input
              type="number"
              min={0}
              value={v.lateGraceMinutes}
              onChange={(e) =>
                set("lateGraceMinutes", Number(e.target.value) || 0)
              }
            />
          </label>
          <fieldset className="space-y-2 sm:col-span-2">
            <legend className="text-xs text-muted-foreground">
              반경 밖 인증 처리
            </legend>
            {(
              [
                ["block", "인증 차단"],
                ["allow_with_warning", "허용 + 관리자 확인 필요"],
                ["ignore_gps", "GPS를 사용하지 않음"],
              ] as const
            ).map(([key, label]) => (
              <label key={key} className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="outsideRadiusPolicy"
                  checked={v.outsideRadiusPolicy === key}
                  onChange={() =>
                    set("outsideRadiusPolicy", key as OutsideRadiusPolicy)
                  }
                />
                {label}
              </label>
            ))}
          </fieldset>
        </div>
      ) : null}
    </div>
  );
}
