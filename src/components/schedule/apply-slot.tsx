"use client";

import { useEffect, useState } from "react";

import { useAuth } from "@/components/providers/auth-provider";
import { createApplication } from "@/lib/firestore-applications";
import { useMediaQuery } from "@/hooks/use-media-query";
import type { PositionDef } from "@/types/schedule";
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

export type ApplySlotContext = {
  eventId: string;
  sessionId: string;
  slotId: string;
  eventTitle: string;
  venue: string;
  date: string;
  slotStart: string;
  capacity: number;
  applied: number;
  usePositions?: boolean;
  positions?: PositionDef[];
};

export function ApplySlotSurface({
  open,
  onOpenChange,
  ctx,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  ctx: ApplySlotContext | null;
}) {
  const isDesktop = useMediaQuery("(min-width: 768px)");
  const { user, profile } = useAuth();
  const [note, setNote] = useState("");
  const [selectedPositionId, setSelectedPositionId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  useEffect(() => {
    if (open) {
      setSubmitError("");
      setSelectedPositionId("");
      setNote("");
    }
  }, [open]);

  if (!ctx) return null;

  const remaining = Math.max(0, ctx.capacity - ctx.applied);
  const hasPositions = ctx.usePositions && ctx.positions && ctx.positions.length > 0;
  const selectedPosition = hasPositions
    ? ctx.positions!.find((p) => p.id === selectedPositionId)
    : undefined;

  const body = (
    <>
      <div className="space-y-2 text-sm text-muted-foreground">
        <p>
          <span className="text-foreground">{ctx.eventTitle}</span>
          <span className="mx-1">·</span>
          {ctx.venue}
        </p>
        <p className="tabular-nums">
          {ctx.date} · {ctx.slotStart} 시작
        </p>
        <p>
          정원 {ctx.applied}/{ctx.capacity}
          {remaining === 0 ? (
            <span className="ml-2 text-amber-400">(마감)</span>
          ) : (
            <span className="ml-2 text-muted-foreground">
              (잔여 {remaining})
            </span>
          )}
        </p>
      </div>

      {hasPositions && (
        <div className="mt-4 space-y-2">
          <label className="text-xs font-medium text-muted-foreground">
            포지션 선택 *
          </label>
          <div className="flex flex-wrap gap-2">
            {ctx.positions!.map((pos) => (
              <button
                key={pos.id}
                type="button"
                onClick={() => setSelectedPositionId(pos.id)}
                className={`rounded-md border px-3 py-1.5 text-sm font-medium transition-colors ${
                  selectedPositionId === pos.id
                    ? "border-accent bg-accent text-accent-foreground"
                    : "border-border bg-muted text-muted-foreground hover:border-accent/50 hover:text-foreground"
                }`}
              >
                {pos.label}
                {pos.capacity > 0 ? (
                  <span className="ml-1 text-xs opacity-70">({pos.capacity})</span>
                ) : null}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="mt-4">
        <label className="text-xs font-medium text-muted-foreground">
          메모 (선택)
        </label>
        <textarea
          className="mt-1.5 flex min-h-[72px] w-full rounded-md border border-border bg-muted px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-60"
          placeholder="운영팀 전달 사항"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          disabled={submitting}
        />
      </div>
      {submitError ? (
        <p className="mt-3 text-xs text-red-300">{submitError}</p>
      ) : null}
    </>
  );

  const handleSubmit = async () => {
    if (!ctx || remaining === 0) return;
    if (!user) {
      setSubmitError("로그인이 필요합니다.");
      return;
    }
    if (hasPositions && !selectedPositionId) {
      setSubmitError("포지션을 선택해 주세요.");
      return;
    }
    setSubmitError("");
    setSubmitting(true);
    try {
      const nick =
        profile?.displayName?.trim() || user.displayName?.trim() || "";
      const applicantDisplayName = nick.slice(0, 80);
      const applicantEmail = user.email ?? "";
      await createApplication({
        userId: user.uid,
        applicantDisplayName,
        applicantEmail,
        eventId: ctx.eventId,
        sessionId: ctx.sessionId,
        slotId: ctx.slotId,
        eventTitle: ctx.eventTitle,
        venue: ctx.venue,
        date: ctx.date,
        slotTime: ctx.slotStart,
        note: note.trim(),
        ...(selectedPosition
          ? {
              positionId: selectedPosition.id,
              positionLabel: selectedPosition.label,
            }
          : {}),
      });
      setNote("");
      setSelectedPositionId("");
      onOpenChange(false);
    } catch (e) {
      setSubmitError(
        e instanceof Error
          ? e.message
          : "저장에 실패했습니다. Firestore 규칙을 게시했는지 확인하세요.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const canSubmit = remaining > 0 && !submitting && (!hasPositions || !!selectedPositionId);

  const footer = (
    <>
      <Button
        type="button"
        variant="outline"
        onClick={() => onOpenChange(false)}
        disabled={submitting}
      >
        취소
      </Button>
      <Button
        type="button"
        variant="accent"
        disabled={!canSubmit}
        onClick={() => void handleSubmit()}
      >
        {submitting ? "제출 중..." : "신청하기"}
      </Button>
    </>
  );

  if (isDesktop) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>슬롯 신청</DialogTitle>
            <DialogDescription>
              제출 시 내 신청 목록(Applications)에 표시됩니다.
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
      <SheetContent side="bottom">
        <SheetHeader>
          <SheetTitle>슬롯 신청</SheetTitle>
          <SheetDescription>
            모바일은 Bottom Sheet로 표시됩니다.
          </SheetDescription>
        </SheetHeader>
        <div className="mt-4">{body}</div>
        <SheetFooter className="mt-6 flex-row gap-2">{footer}</SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
