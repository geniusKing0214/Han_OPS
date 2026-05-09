"use client";

import { ScheduleBoard } from "@/components/schedule/schedule-board";
import { useEvents } from "@/hooks/use-events";

export default function SchedulePage() {
  const { events, loading, error } = useEvents();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Schedule</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          달력으로 날짜를 고르고, 해당 날짜의 이벤트를 카드에서 펼칩니다.
        </p>
      </div>
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
