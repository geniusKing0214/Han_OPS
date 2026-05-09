"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { EventScheduleEditor } from "@/components/admin/event-schedule-editor";
import { useEvents } from "@/hooks/use-events";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

function AdminEventScheduleInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const eventId = searchParams.get("id")?.trim() ?? "";
  const { events, loading, error } = useEvents();
  const event = events.find((e) => e.id === eventId);

  if (!eventId) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">이벤트 ID가 없습니다</CardTitle>
          <CardDescription>
            Admin → 일정 →「새 창에서 편집」로 열거나, URL에{' '}
            <span className="font-mono text-foreground">?id=일정-ID</span> 를
            붙여 주세요.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button type="button" variant="accent" asChild>
            <Link href="/admin/schedule">일정 목록으로</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="ghost" size="sm" className="gap-1 px-0 sm:px-3" asChild>
          <Link href="/admin/schedule">
            <ArrowLeft className="size-4" />
            일정 목록으로
          </Link>
        </Button>
      </div>

      <div>
        <h1 className="text-2xl font-semibold tracking-tight">이벤트 편집</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          이 창에서 편집한 내용은 Firestore에 바로 반영됩니다.
        </p>
      </div>

      {error ? (
        <p className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
          일정 로드 오류: {error}
        </p>
      ) : null}

      {loading && !event ? (
        <p className="text-sm text-muted-foreground">불러오는 중...</p>
      ) : null}

      {!loading && !event ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">일정을 찾을 수 없습니다</CardTitle>
            <CardDescription>
              ID{" "}
              <span className="font-mono text-foreground">{eventId}</span>에 해당하는
              이벤트가 없거나 삭제되었습니다.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button type="button" variant="accent" asChild>
              <Link href="/admin/schedule">일정 목록으로</Link>
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {event ? (
        <EventScheduleEditor
          event={event}
          onDeleted={() => router.push("/admin/schedule")}
        />
      ) : null}
    </div>
  );
}

export default function AdminEventScheduleEditPage() {
  return (
    <Suspense
      fallback={
        <p className="text-sm text-muted-foreground">불러오는 중...</p>
      }
    >
      <AdminEventScheduleInner />
    </Suspense>
  );
}
