"use client";

import { useState } from "react";

import { AttendanceCheckInSurface } from "@/components/attendance/attendance-check-in-surface";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  canShowCheckInButton,
  pickLatestAttendance,
} from "@/lib/firestore-attendance";
import { formatAttendanceDateTime } from "@/lib/attendance-window";
import {
  LOCATION_STATUS_LABELS,
  PHOTO_STATUS_LABELS,
  REVIEW_STATUS_LABELS,
  TIME_STATUS_LABELS,
  type AttendanceRecord,
} from "@/types/attendance";
import type { ApplicationItem } from "@/types/application";
import type { EventItem } from "@/types/schedule";

export function AttendanceStatusBlock({
  app,
  event,
  attendances,
}: {
  app: ApplicationItem;
  event: EventItem | undefined;
  attendances: AttendanceRecord[];
}) {
  const [open, setOpen] = useState(false);
  const existing = pickLatestAttendance(attendances, app.id);
  const showButton = canShowCheckInButton({ app, event, existing });

  if (!event?.attendance?.attendanceEnabled) return null;
  if (app.status !== "approved" && app.status !== "completed") return null;

  if (showButton && event) {
    return (
      <>
        <Button
          type="button"
          variant="accent"
          className="mt-3 h-11 w-full sm:w-auto"
          onClick={() => setOpen(true)}
        >
          {existing?.reviewStatus === "rejected" ? "다시 인증" : "출근 인증"}
        </Button>
        {existing?.reviewStatus === "rejected" && existing.rejectionReason ? (
          <p className="mt-2 text-xs text-amber-700">
            재확인 사유: {existing.rejectionReason}
          </p>
        ) : null}
        <AttendanceCheckInSurface
          open={open}
          onOpenChange={setOpen}
          app={app}
          event={event}
          previousAttendanceId={existing?.id}
          attempt={(existing?.attempt ?? 0) + 1}
        />
      </>
    );
  }

  if (!existing) return null;

  if (existing.reviewStatus === "pending") {
    return (
      <div className="mt-3 space-y-1.5 rounded-md border border-border bg-muted/40 px-3 py-2.5 text-sm">
        <p className="font-medium text-accent">출근 인증 완료</p>
        <p className="text-xs text-muted-foreground tabular-nums">
          인증 시간{" "}
          {existing.actualCheckInAt
            ? formatAttendanceDateTime(existing.actualCheckInAt)
            : "—"}
        </p>
        <div className="flex flex-wrap gap-1.5 pt-1">
          <Badge variant="warning">{REVIEW_STATUS_LABELS.pending}</Badge>
          <Badge variant="outline">
            {TIME_STATUS_LABELS[existing.timeStatus]}
          </Badge>
          <Badge variant="outline">
            {LOCATION_STATUS_LABELS[existing.locationStatus]}
          </Badge>
        </div>
      </div>
    );
  }

  if (existing.reviewStatus === "approved") {
    const photoDeleted = existing.photoStatus === "deleted";
    return (
      <div className="mt-3 space-y-1.5 rounded-md border border-border bg-muted/40 px-3 py-2.5 text-sm">
        <p className="font-medium text-emerald-600">출근 인증 확인 완료</p>
        {existing.reviewedAt ? (
          <p className="text-xs text-muted-foreground tabular-nums">
            관리자 확인 시간 {formatAttendanceDateTime(existing.reviewedAt)}
          </p>
        ) : null}
        <p className="text-xs text-muted-foreground">
          {photoDeleted
            ? "인증 사진은 개인정보 보호를 위해 자동 삭제되었습니다."
            : PHOTO_STATUS_LABELS[existing.photoStatus]}
        </p>
      </div>
    );
  }

  if (existing.reviewStatus === "rejected") {
    return (
      <div className="mt-3 space-y-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2.5 text-sm">
        <p className="font-medium text-amber-200">출근 인증 재확인 필요</p>
        <p className="text-xs text-muted-foreground">
          사유: {existing.rejectionReason || "기타"}
        </p>
        {event ? (
          <>
            <Button
              type="button"
              variant="accent"
              className="h-11 w-full sm:w-auto"
              onClick={() => setOpen(true)}
            >
              다시 인증
            </Button>
            <AttendanceCheckInSurface
              open={open}
              onOpenChange={setOpen}
              app={app}
              event={event}
              previousAttendanceId={existing.id}
              attempt={existing.attempt + 1}
            />
          </>
        ) : null}
      </div>
    );
  }

  return null;
}
