"use client";

import { useState } from "react";

import { CreateScheduleDialog } from "@/components/admin/event-form-dialog";
import { useAuth } from "@/components/providers/auth-provider";
import { Button } from "@/components/ui/button";
import { ScheduleBoard } from "@/components/schedule/schedule-board";
import { useEvents } from "@/hooks/use-events";
import type { EventItem } from "@/types/schedule";
import { saveEvent } from "@/lib/firestore-events";

export default function SchedulePage() {
  const { isAdmin } = useAuth();
  const { events, loading, error } = useEvents();
  const [createOpen, setCreateOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [createError, setCreateError] = useState("");

  const handleCreateSave = async (payload: Omit<EventItem, "id">) => {
    const id = crypto.randomUUID();
    setSaving(true);
    setCreateError("");
    try {
      await saveEvent({ ...payload, id });
    } catch (err) {
      setCreateError(
        err instanceof Error
          ? err.message
          : "일정 생성에 실패했습니다. 권한/네트워크를 확인하세요.",
      );
      throw err;
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Schedule</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            달력으로 날짜를 고르고, 해당 날짜의 이벤트를 카드에서 펼칩니다.
          </p>
        </div>
        {isAdmin ? (
          <Button
            type="button"
            variant="accent"
            onClick={() => setCreateOpen(true)}
            disabled={saving}
          >
            스케줄 생성
          </Button>
        ) : null}
      </div>

      {isAdmin ? (
        <CreateScheduleDialog
          open={createOpen}
          onOpenChange={setCreateOpen}
          saving={saving}
          onSave={handleCreateSave}
        />
      ) : null}

      {createError ? (
        <p className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          일정 생성 오류: {createError}
        </p>
      ) : null}
      {error ? (
        <p className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
          일정을 불러오지 못했습니다: {error}
        </p>
      ) : null}
      {loading ? (
        <p className="text-sm text-muted-foreground">일정 동기화 중...</p>
      ) : null}
      {!loading && events.length === 0 ? (
        <p className="rounded-lg border border-border bg-muted/40 px-4 py-8 text-center text-sm text-muted-foreground">
          등록된 일정이 없습니다. 관리자가 Admin → Schedule Manager에서 일정을
          추가하면 표시됩니다.
        </p>
      ) : (
        <ScheduleBoard events={events} />
      )}
    </div>
  );
}
