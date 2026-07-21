"use client";

import { useEffect, useState } from "react";

import { useAuth } from "@/components/providers/auth-provider";
import { createApplication } from "@/lib/firestore-applications";
import { useMediaQuery } from "@/hooks/use-media-query";
import type { PositionDef, PositionSlot } from "@/types/schedule";
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
  eventTitle: string;
  venue: string;
  date: string;
  // 일반 슬롯 (usePositions=false)
  slotId?: string;
  slotStart?: string;
  capacity?: number;
  applied?: number;
  // 포지션 기반 (usePositions=true)
  usePositions?: boolean;
  positions?: PositionDef[];
};

/** 포지션+슬롯 선택 상태 */
type SelectedCombo = {
  position: PositionDef;
  slot: PositionSlot;
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
  // 일반 슬롯용
  const [selectedPositionId, setSelectedPositionId] = useState("");
  // Option B: 포지션+시간 콤보 선택
  const [selectedCombo, setSelectedCombo] = useState<SelectedCombo | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  useEffect(() => {
    if (open) {
      setSubmitError("");
      setSelectedPositionId("");
      setSelectedCombo(null);
      setNote("");
    }
  }, [open]);

  if (!ctx) return null;

  const hasPositionSlots =
    ctx.usePositions &&
    ctx.positions &&
    ctx.positions.some((p) => p.slots && p.slots.length > 0);

  // 일반 슬롯용
  const hasSimplePositions =
    ctx.usePositions && ctx.positions && ctx.positions.length > 0 && !hasPositionSlots;

  const remaining = hasPositionSlots
    ? null // position-based: check per slot
    : Math.max(0, (ctx.capacity ?? 0) - (ctx.applied ?? 0));

  // ── 일반 슬롯 body ──────────────────────────────────────────────
  const regularBody = (
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
            <span className="ml-2 text-muted-foreground">(잔여 {remaining})</span>
          )}
        </p>
      </div>

      {hasSimplePositions && (
        <div className="mt-4 space-y-2">
          <label className="text-xs font-medium text-muted-foreground">포지션 선택 *</label>
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
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="mt-4">
        <label className="text-xs font-medium text-muted-foreground">메모 (선택)</label>
        <textarea
          className="mt-1.5 flex min-h-[72px] w-full rounded-md border border-border bg-muted px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-60"
          placeholder="운영팀 전달 사항"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          disabled={submitting}
        />
      </div>
      {submitError ? <p className="mt-3 text-xs text-red-300">{submitError}</p> : null}
    </>
  );

  // ── Option B: 포지션×시간 그리드 body ──────────────────────────
  const positionSlotBody = (
    <>
      <div className="space-y-1 text-sm text-muted-foreground">
        <p>
          <span className="text-foreground font-medium">{ctx.eventTitle}</span>
          <span className="mx-1">·</span>
          {ctx.venue}
        </p>
        <p className="tabular-nums text-xs">{ctx.date}</p>
      </div>

      <div className="mt-4 space-y-1">
        <p className="text-xs font-medium text-muted-foreground">포지션 · 시간 선택 *</p>
        <div className="rounded-lg border border-border bg-muted/20 overflow-hidden">
          {ctx.positions!.filter((p) => p.slots && p.slots.length > 0).map((pos, pi, arr) => (
            <div
              key={pos.id}
              className={`px-3 py-2.5 ${pi !== arr.length - 1 ? "border-b border-border" : ""}`}
            >
              <p className="text-xs font-semibold text-foreground mb-2">{pos.label}</p>
              <div className="flex flex-wrap gap-2">
                {pos.slots.map((slot) => {
                  const isSelected =
                    selectedCombo?.position.id === pos.id &&
                    selectedCombo?.slot.id === slot.id;
                  const slotRemaining = Math.max(0, slot.capacity - slot.applied_count);
                  const full = slotRemaining === 0;
                  return (
                    <button
                      key={slot.id}
                      type="button"
                      disabled={full}
                      onClick={() =>
                        setSelectedCombo(
                          isSelected ? null : { position: pos, slot },
                        )
                      }
                      className={`rounded-md border px-3 py-1.5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                        isSelected
                          ? "border-accent bg-accent text-accent-foreground"
                          : full
                            ? "border-border bg-muted/30 text-muted-foreground"
                            : "border-border bg-muted text-muted-foreground hover:border-accent/50 hover:text-foreground"
                      }`}
                    >
                      <span className="tabular-nums">{slot.time}</span>
                      <span className="ml-1.5 text-xs opacity-70">
                        {full ? "마감" : `잔여 ${slotRemaining}/${slot.capacity}`}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
        {selectedCombo && (
          <p className="text-xs text-accent mt-1">
            선택: {selectedCombo.position.label} · {selectedCombo.slot.time}
          </p>
        )}
      </div>

      <div className="mt-4">
        <label className="text-xs font-medium text-muted-foreground">메모 (선택)</label>
        <textarea
          className="mt-1.5 flex min-h-[64px] w-full rounded-md border border-border bg-muted px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-60"
          placeholder="운영팀 전달 사항"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          disabled={submitting}
        />
      </div>
      {submitError ? <p className="mt-3 text-xs text-red-300">{submitError}</p> : null}
    </>
  );

  const body = hasPositionSlots ? positionSlotBody : regularBody;

  const handleSubmit = async () => {
    if (!ctx) return;
    if (!user) { setSubmitError("로그인이 필요합니다."); return; }

    // Option B 검증
    if (hasPositionSlots) {
      if (!selectedCombo) { setSubmitError("포지션과 시간을 선택해 주세요."); return; }
      const slotRemaining = Math.max(0, selectedCombo.slot.capacity - selectedCombo.slot.applied_count);
      if (slotRemaining === 0) { setSubmitError("선택한 슬롯이 마감되었습니다."); return; }
    } else {
      if (remaining === 0) return;
      if (hasSimplePositions && !selectedPositionId) {
        setSubmitError("포지션을 선택해 주세요."); return;
      }
    }

    setSubmitError("");
    setSubmitting(true);
    try {
      const nick = profile?.displayName?.trim() || user.displayName?.trim() || "";
      const applicantDisplayName = nick.slice(0, 80);
      const applicantEmail = user.email ?? "";

      if (hasPositionSlots && selectedCombo) {
        // Option B 신청
        await createApplication({
          userId: user.uid,
          applicantDisplayName,
          applicantEmail,
          eventId: ctx.eventId,
          sessionId: ctx.sessionId,
          slotId: "",
          eventTitle: ctx.eventTitle,
          venue: ctx.venue,
          date: ctx.date,
          slotTime: selectedCombo.slot.time,
          note: note.trim(),
          positionId: selectedCombo.position.id,
          positionLabel: selectedCombo.position.label,
          positionSlotId: selectedCombo.slot.id,
          positionSlotTime: selectedCombo.slot.time,
        });
      } else {
        // 일반 신청
        const selectedPos = hasSimplePositions
          ? ctx.positions!.find((p) => p.id === selectedPositionId)
          : undefined;
        await createApplication({
          userId: user.uid,
          applicantDisplayName,
          applicantEmail,
          eventId: ctx.eventId,
          sessionId: ctx.sessionId,
          slotId: ctx.slotId ?? "",
          eventTitle: ctx.eventTitle,
          venue: ctx.venue,
          date: ctx.date,
          slotTime: ctx.slotStart ?? "",
          note: note.trim(),
          ...(selectedPos
            ? { positionId: selectedPos.id, positionLabel: selectedPos.label }
            : {}),
        });
      }

      setNote("");
      setSelectedCombo(null);
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

  const canSubmit = hasPositionSlots
    ? !!selectedCombo && !submitting
    : (remaining ?? 0) > 0 && !submitting && (!hasSimplePositions || !!selectedPositionId);

  const footer = (
    <>
      <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
        취소
      </Button>
      <Button type="button" variant="accent" disabled={!canSubmit} onClick={() => void handleSubmit()}>
        {submitting ? "제출 중..." : "신청하기"}
      </Button>
    </>
  );

  if (isDesktop) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>슬롯 신청</DialogTitle>
            <DialogDescription>제출 시 내 신청 목록(Applications)에 표시됩니다.</DialogDescription>
          </DialogHeader>
          {body}
          <DialogFooter className="gap-2 sm:gap-0">{footer}</DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[85dvh] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>슬롯 신청</SheetTitle>
          <SheetDescription>포지션과 시간을 선택하고 신청합니다.</SheetDescription>
        </SheetHeader>
        <div className="mt-4">{body}</div>
        <SheetFooter className="mt-6 flex-row gap-2">{footer}</SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
