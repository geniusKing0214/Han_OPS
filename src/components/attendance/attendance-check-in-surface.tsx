"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Loader2, MapPin, ShieldAlert } from "lucide-react";

import { useAuth } from "@/components/providers/auth-provider";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useMediaQuery } from "@/hooks/use-media-query";
import {
  GpsSessionTracker,
  haversineMeters,
  watchPosition,
  type MockLocationSignal,
} from "@/lib/attendance-geo";
import { submitAttendanceCheckIn } from "@/lib/firestore-attendance";
import { normalizeTeamId } from "@/lib/team-utils";
import type { ApplicationItem } from "@/types/application";
import type { EventItem } from "@/types/schedule";

// ──────────────────────────────────────────────
// 거리 표시 헬퍼
// ──────────────────────────────────────────────
function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)}m`;
  return `${(meters / 1000).toFixed(1)}km`;
}

function radiusProgress(distanceM: number, radiusM: number): number {
  return Math.max(0, Math.min(1, 1 - (distanceM - radiusM) / radiusM));
}

// ──────────────────────────────────────────────
// 실시간 거리 인디케이터
// ──────────────────────────────────────────────
function DistanceIndicator({
  distanceMeters,
  radiusMeters,
  inside,
  accuracy,
}: {
  distanceMeters: number | null;
  radiusMeters: number;
  inside: boolean;
  accuracy: number | null;
}) {
  if (distanceMeters === null) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
        <Loader2 className="size-3.5 animate-spin" />
        GPS 수신 중…
      </div>
    );
  }

  const progress = inside ? 1 : radiusProgress(distanceMeters, radiusMeters);
  const barColor =
    inside ? "#3ecf8e"
    : distanceMeters < radiusMeters * 1.5 ? "#f59e0b"
    : "#f87171";

  return (
    <div
      className={`rounded-lg border px-3 py-2.5 text-xs transition-colors ${
        inside
          ? "border-green-500/40 bg-green-500/10"
          : "border-border bg-muted/30"
      }`}
    >
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <MapPin
            className={`size-3.5 ${inside ? "text-green-400" : "text-muted-foreground"}`}
          />
          {inside ? (
            <span className="font-semibold text-green-400">반경 안에 있습니다 ✓</span>
          ) : (
            <span className="text-foreground">
              행사장까지 약{" "}
              <span className="font-semibold">{formatDistance(distanceMeters)}</span>
            </span>
          )}
        </div>
        {accuracy !== null && (
          <span className="text-muted-foreground">정확도 ±{Math.round(accuracy)}m</span>
        )}
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${progress * 100}%`, backgroundColor: barColor }}
        />
      </div>
      {!inside && (
        <p className="mt-1 text-muted-foreground">
          허용 반경 {radiusMeters}m 이내로 이동해주세요
        </p>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────
// Mock Location 경고
// ──────────────────────────────────────────────
function MockLocationWarning({ signal }: { signal: MockLocationSignal }) {
  if (!signal.suspicious) return null;
  return (
    <div className="flex gap-2 rounded-lg border border-yellow-500/40 bg-yellow-500/10 px-3 py-2 text-xs text-yellow-300">
      <ShieldAlert className="mt-0.5 size-3.5 shrink-0" />
      <div>
        <p className="font-semibold">위치 이상 감지</p>
        <ul className="mt-0.5 list-disc pl-3 text-yellow-300/80">
          {signal.reasons.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
        <p className="mt-1 text-yellow-300/70">
          실제 기기 GPS를 사용하고 있는지 확인해주세요.
        </p>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────
// 메인 컴포넌트
// ──────────────────────────────────────────────
export function AttendanceCheckInSurface({
  open,
  onOpenChange,
  app,
  event,
  previousAttendanceId,
  attempt,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  app: ApplicationItem;
  event: EventItem;
  previousAttendanceId?: string | null;
  attempt?: number;
}) {
  const isDesktop = useMediaQuery("(min-width: 768px)");
  const { user, profile } = useAuth();

  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // 실시간 GPS 상태
  const [distanceMeters, setDistanceMeters] = useState<number | null>(null);
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [insideRadius, setInsideRadius] = useState(false);
  const [mockSignal, setMockSignal] = useState<MockLocationSignal>({
    suspicious: false,
    reasons: [],
    riskLevel: "none",
  });

  const trackerRef = useRef(new GpsSessionTracker());

  const settings = event.attendance;
  const needsGps =
    settings?.locationVerificationEnabled &&
    settings.outsideRadiusPolicy !== "ignore_gps";
  const venueHasCoords =
    settings?.venueLatitude != null && settings?.venueLongitude != null;
  const allowedRadius = settings?.allowedRadiusMeters ?? 150;

  // watchPosition 구독
  useEffect(() => {
    if (!open) return;

    setPhotoFile(null);
    setPreviewUrl(null);
    setError("");
    setGpsError(null);
    setDistanceMeters(null);
    setAccuracy(null);
    setInsideRadius(!needsGps || !venueHasCoords);
    setMockSignal({ suspicious: false, reasons: [], riskLevel: "none" });
    trackerRef.current.reset();

    if (!needsGps || !venueHasCoords) return;

    const stop = watchPosition(
      (pos) => {
        const tracker = trackerRef.current;
        tracker.addReading(pos);

        const lat = pos.coords.latitude;
        const lon = pos.coords.longitude;
        const acc = pos.coords.accuracy;

        setAccuracy(acc);
        setGpsError(null);

        if (settings?.venueLatitude != null && settings?.venueLongitude != null) {
          const dist = Math.round(
            haversineMeters(lat, lon, settings.venueLatitude, settings.venueLongitude),
          );
          setDistanceMeters(dist);
          const isInside = dist <= allowedRadius;
          // block 정책이 아니면 반경 밖이어도 제출은 허용
          setInsideRadius(isInside || settings.outsideRadiusPolicy !== "block");
        }

        const signal = tracker.detectMockLocation();
        setMockSignal(signal);
      },
      (err) => {
        setGpsError(err.message);
        if (settings?.outsideRadiusPolicy !== "block") {
          setInsideRadius(true);
        }
      },
    );

    return stop;
  }, [
    open,
    needsGps,
    venueHasCoords,
    allowedRadius,
    settings?.venueLatitude,
    settings?.venueLongitude,
    settings?.outsideRadiusPolicy,
  ]);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const onPickFile = (file: File | null) => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPhotoFile(file);
    setPreviewUrl(file ? URL.createObjectURL(file) : null);
  };

  const canSubmit =
    !!user &&
    !submitting &&
    (!settings?.photoRequired || !!photoFile) &&
    insideRadius;

  const handleSubmit = async () => {
    if (!user || !canSubmit) return;
    setSubmitting(true);
    setError("");
    try {
      const latest = trackerRef.current.latestReading;
      await submitAttendanceCheckIn({
        app,
        event,
        userId: user.uid,
        userName:
          profile?.displayName?.trim() ||
          user.displayName?.trim() ||
          user.email ||
          "멤버",
        teamId: normalizeTeamId(profile?.teamId ?? app.team_id),
        photoFile,
        previousAttendanceId,
        attempt,
        prefetchedPosition: latest
          ? {
              latitude: latest.latitude,
              longitude: latest.longitude,
              accuracy: latest.accuracy,
            }
          : undefined,
        mockLocationSignal: mockSignal.suspicious ? mockSignal : undefined,
      });
      onOpenChange(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "출근 인증에 실패했습니다.");
    } finally {
      setSubmitting(false);
    }
  };

  const body = (
    <div className="space-y-4">
      {/* 이벤트 정보 */}
      <div className="space-y-0.5 text-sm text-muted-foreground">
        <p>
          <span className="font-medium text-foreground">{app.eventTitle}</span>
        </p>
        <p className="tabular-nums">
          {app.date} · 예정 출근 {app.slotTime}
        </p>
        <p>{app.venue}</p>
        <p>현재 시각 {new Date().toLocaleTimeString("ko-KR")}</p>
        {gpsError && <p className="text-xs text-red-400">GPS 오류: {gpsError}</p>}
      </div>

      {/* 실시간 거리 인디케이터 */}
      {needsGps && venueHasCoords && (
        <DistanceIndicator
          distanceMeters={distanceMeters}
          radiusMeters={allowedRadius}
          inside={
            insideRadius &&
            distanceMeters !== null &&
            distanceMeters <= allowedRadius
          }
          accuracy={accuracy}
        />
      )}

      {/* 반경 진입 완료 배지 */}
      {needsGps &&
        distanceMeters !== null &&
        distanceMeters <= allowedRadius && (
          <div className="flex items-center gap-2 rounded-lg border border-green-500/30 bg-green-500/10 px-3 py-2 text-xs font-medium text-green-400">
            <CheckCircle2 className="size-4" />
            반경 진입 확인 — 인증 가능합니다
          </div>
        )}

      {/* Mock Location 경고 */}
      <MockLocationWarning signal={mockSignal} />

      {/* 사진 업로드 */}
      {settings?.photoRequired !== false ? (
        <div className="space-y-2">
          <label className="text-xs font-medium text-muted-foreground">
            인증 사진 {settings?.photoRequired ? "(필수)" : "(선택)"}
          </label>
          <input
            type="file"
            accept="image/*"
            capture="environment"
            className="block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-accent file:px-3 file:py-2 file:text-sm file:font-medium file:text-accent-foreground"
            onChange={(e) => onPickFile(e.target.files?.[0] ?? null)}
            disabled={submitting}
          />
          {previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={previewUrl}
              alt="미릤보기"
              className="max-h-56 w-full rounded-lg border border-border object-cover"
            />
          ) : (
            <div className="flex h-40 items-center justify-center rounded-lg border border-dashed border-border text-xs text-muted-foreground">
              사진 미릤보기
            </div>
          )}
        </div>
      ) : null}

      {error ? (
        <p className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
          {error}
        </p>
      ) : null}
    </div>
  );

  const footer = (
    <>
      <Button
        type="button"
        variant="outline"
        disabled={submitting}
        onClick={() => onOpenChange(false)}
      >
        취소
      </Button>
      <Button
        type="button"
        variant="accent"
        disabled={!canSubmit}
        onClick={() => void handleSubmit()}
        className="min-h-11"
      >
        {submitting ? (
          <>
            <Loader2 className="size-4 animate-spin" />
            제출 중...
          </>
        ) : (
          "출근 인증 제출"
        )}
      </Button>
    </>
  );

  if (isDesktop) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>출근 인증</DialogTitle>
            <DialogDescription>
              사진과 위치를 확인해 출근을 인증합니다.
            </DialogDescription>
          </DialogHeader>
          {body}
          <DialogFooter className="gap-2 sm:gap-0">{footer}</DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[90dvh] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>출근 인증</SheetTitle>
          <SheetDescription>
            카메라로 촬영하거나 앨범에서 선택하세요.
          </SheetDescription>
        </SheetHeader>
        <div className="mt-4">{body}</div>
        <SheetFooter className="mt-6 flex-row gap-2">{footer}</SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
 
