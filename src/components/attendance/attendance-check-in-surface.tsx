"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

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
import { getCurrentPosition } from "@/lib/attendance-geo";
import { submitAttendanceCheckIn } from "@/lib/firestore-attendance";
import { normalizeTeamId } from "@/lib/team-utils";
import type { ApplicationItem } from "@/types/application";
import type { EventItem } from "@/types/schedule";

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
  const [gpsLabel, setGpsLabel] = useState("GPS 확인 대기");
  const [gpsReady, setGpsReady] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const settings = event.attendance;
  const needsGps =
    settings?.locationVerificationEnabled &&
    settings.outsideRadiusPolicy !== "ignore_gps";

  useEffect(() => {
    if (!open) return;
    setPhotoFile(null);
    setPreviewUrl(null);
    setError("");
    setGpsReady(!needsGps);
    setGpsLabel(needsGps ? "GPS 확인 중…" : "GPS 미사용");

    if (!needsGps) return;
    let cancelled = false;
    void getCurrentPosition()
      .then((pos) => {
        if (cancelled) return;
        setGpsReady(true);
        setGpsLabel(
          `위치 확인됨 · 정확도 ±${Math.round(pos.coords.accuracy)}m`,
        );
      })
      .catch(() => {
        if (cancelled) return;
        setGpsReady(settings?.outsideRadiusPolicy !== "block");
        setGpsLabel("GPS를 가져오지 못했습니다");
      });
    return () => {
      cancelled = true;
    };
  }, [open, needsGps, settings?.outsideRadiusPolicy]);

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
    (!needsGps || gpsReady);

  const handleSubmit = async () => {
    if (!user || !canSubmit) return;
    setSubmitting(true);
    setError("");
    try {
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
      <div className="space-y-1 text-sm text-muted-foreground">
        <p>
          <span className="font-medium text-foreground">{app.eventTitle}</span>
        </p>
        <p className="tabular-nums">
          {app.date} · 예정 출근 {app.slotTime}
        </p>
        <p>{app.venue}</p>
        <p>현재 시각 {new Date().toLocaleTimeString("ko-KR")}</p>
        <p>{gpsLabel}</p>
      </div>

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
              alt="미리보기"
              className="max-h-56 w-full rounded-lg border border-border object-cover"
            />
          ) : (
            <div className="flex h-40 items-center justify-center rounded-lg border border-dashed border-border text-xs text-muted-foreground">
              사진 미리보기
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
