"use client";

import { useMemo, useState } from "react";

import { CreateScheduleDialog } from "@/components/admin/event-form-dialog";
import { TeamFilter } from "@/components/team/team-filter";
import { useAuth } from "@/components/providers/auth-provider";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/layout/page-header";
import { ScheduleBoard } from "@/components/schedule/schedule-board";
import { useEvents } from "@/hooks/use-events";
import type { EventItem } from "@/types/schedule";
import { createScheduleEvent } from "@/lib/firestore-events";
import {
  filterEventsByTeamFilter,
  filterEventsForMember,
} from "@/lib/team-utils";
import type { TeamFilterValue } from "@/types/team";

export default function SchedulePage() {
  const { isAdmin, profile, user } = useAuth();
  const { events, loading, error } = useEvents();
  const [teamFilter, setTeamFilter] = useState<TeamFilterValue>("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [createError, setCreateError] = useState("");

  const visibleEvents = useMemo(() => {
    if (isAdmin) {
      return filterEventsByTeamFilter(events, teamFilter);
    }
    return filterEventsForMember(events, profile?.teamId);
  }, [events, isAdmin, profile?.teamId, teamFilter]);

  const handleCreateSave = async (payload: Omit<EventItem, "id">) => {
    const id = crypto.randomUUID();
    if (!user) {
      setCreateError("로그인이 필요합니다.");
      throw new Error("로그인이 필요합니다.");
    }
    setSaving(true);
    setCreateError("");
    try {
      await createScheduleEvent({ ...payload, id }, user.uid);
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
      <PageHeader
        title="Schedule"
        description={
          isAdmin ? "팀별 일정을 확인하고 관리합니다." : "소속 팀 일정만 표시됩니다."
        }
        actions={
          isAdmin ? (
            <Button
              type="button"
              variant="accent"
              onClick={() => setCreateOpen(true)}
              disabled={saving}
            >
              스케줄 생성
            </Button>
          ) : undefined
        }
      />

      {isAdmin ? (
        <TeamFilter value={teamFilter} onChange={setTeamFilter} />
      ) : null}

      {isAdmin ? (
        <CreateScheduleDialog
          open={createOpen}
          onOpenChange={setCreateOpen}
          saving={saving}
          onSave={handleCreateSave}
        />
      ) : null}

      {createError ? (
        <p className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-700">
          일정 생성 오류: {createError}
        </p>
      ) : null}
      {error ? (
        <p className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-800">
          일정을 불러오지 못했습니다: {error}
        </p>
      ) : null}
      {loading ? (
        <p className="text-sm text-muted-foreground">일정 동기화 중...</p>
      ) : null}
      {!loading && visibleEvents.length === 0 ? (
        <p className="rounded-lg border border-border bg-muted/40 px-4 py-8 text-center text-sm text-muted-foreground">
          {isAdmin
            ? "선택한 팀에 표시할 일정이 없습니다."
            : "등록된 일정이 없습니다. 관리자가 일정을 추가하면 표시됩니다."}
        </p>
      ) : (
        <ScheduleBoard
          events={visibleEvents}
          memberTeamId={isAdmin ? undefined : profile?.teamId}
        />
      )}
    </div>
  );
}

