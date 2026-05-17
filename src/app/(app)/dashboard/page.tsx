"use client";

import Link from "next/link";
import { useMemo } from "react";
import { Calendar, CheckCircle2, ClipboardList, Timer } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { DashboardRecentApplications } from "@/components/dashboard/dashboard-recent-applications";
import { useMyApplications } from "@/hooks/use-my-applications";
import { useEvents } from "@/hooks/use-events";
import { useNotices } from "@/hooks/use-notices";
import { filterApplicationsMatchingLiveSchedule } from "@/lib/applications-match-schedule";
import { statusLabels } from "@/types/application";
import { mockAdminAlerts } from "@/data/mock-notices";

const RECENT_NOTICES_LIMIT = 3;

function toYmd(date: Date): string {
  const y = date.getFullYear();
  const m = `${date.getMonth() + 1}`.padStart(2, "0");
  const d = `${date.getDate()}`.padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function monthPrefix(date: Date): string {
  const y = date.getFullYear();
  const m = `${date.getMonth() + 1}`.padStart(2, "0");
  return `${y}-${m}`;
}

function formatNoticeDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("ko-KR", { dateStyle: "medium" });
  } catch {
    return iso.slice(0, 10);
  }
}

export default function DashboardPage() {
  const { items: rawApplications, loading: appsLoading } = useMyApplications();
  const { events } = useEvents();
  const { rows: notices, loading: noticesLoading } = useNotices();
  const recentNotices = useMemo(() => notices.slice(0, RECENT_NOTICES_LIMIT), [notices]);
  const myApplications = useMemo(
    () => filterApplicationsMatchingLiveSchedule(rawApplications, events),
    [rawApplications, events],
  );
  const today = toYmd(new Date());
  const thisMonth = monthPrefix(new Date());

  const stats = useMemo(() => {
    const approvedApps = myApplications.filter((a) => a.status === "approved");
    const uniqApprovedToday = new Set(
      approvedApps
        .filter((a) => a.date === today)
        .map((a) => a.eventId ?? a.eventTitle),
    );
    const todayCount = uniqApprovedToday.size;
    const pending = myApplications.filter((a) => a.status === "pending").length;
    const uniqApprovedMonth = new Set(
      approvedApps
        .filter((a) => a.date.startsWith(thisMonth))
        .map((a) => a.eventId ?? a.eventTitle),
    );
    const monthWorked = uniqApprovedMonth.size;

    const appliedEventIds = new Set(
      myApplications
        .filter(
          (a) =>
            (a.status === "pending" ||
              a.status === "approved" ||
              a.status === "completed") &&
            a.eventId,
        )
        .map((a) => a.eventId as string),
    );
    const availableEvents = events.filter((ev) => !appliedEventIds.has(ev.id)).length;
    return {
      todayShiftCount: todayCount,
      pendingApprovals: pending,
      openSlots: availableEvents,
      monthWorked,
    };
  }, [events, myApplications, thisMonth, today]);

  const myBlocks = useMemo(
    () =>
      [...myApplications]
        .filter((a) => a.status !== "rejected")
        .sort((a, b) => `${a.date} ${a.slotTime}`.localeCompare(`${b.date} ${b.slotTime}`))
        .slice(0, 3),
    [myApplications],
  );

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          ?¥ÏòÅ ?ÑÌô© Í∞úÏöî ¬∑ ?∞Ïù¥???∞Îèô ?ÑÏóê??Îπ??îÎ©¥?ºÎ°ú ?åÏä§?∏Ìï† ???àÏäµ?àÎã§.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">?§Îäò ?ºÏ†ï</CardTitle>
            <Calendar className="size-4 text-accent" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold tabular-nums">
              {stats.todayShiftCount}
            </p>
            <p className="text-xs text-muted-foreground">Î∞∞Ï†ï??Í∑ºÎ¨¥ Î∏îÎ°ù</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">?πÏù∏ ?ÄÍ∏?/CardTitle>
            <Timer className="size-4 text-amber-400/90" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold tabular-nums">
              {stats.pendingApprovals}
            </p>
            <p className="text-xs text-muted-foreground">Í¥ÄÎ¶¨Ïûê Í≤Ä???ÑÏöî</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">?†Ï≤≠ Í∞Ä???ºÏ†ï</CardTitle>
            <ClipboardList className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold tabular-nums">
              {stats.openSlots}
            </p>
            <p className="text-xs text-muted-foreground">?¨Î°Ø ?îÏó¨ Ï°¥Ïû¨</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">?¥Î≤à ??Í∑ºÎ¨¥</CardTitle>
            <CheckCircle2 className="size-4 text-emerald-400/90" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold tabular-nums">
              {stats.monthWorked}
            </p>
            <p className="text-xs text-muted-foreground">?ïÏ†ï/?ÑÎ£å Í∏∞Ï?</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>???†Ï≤≠ Î∏îÎ°ù</CardTitle>
              <CardDescription>ÏµúÍ∑º 3Í±¥Îßå ?úÏãú ¬∑ ?ÑÏ≤¥??Applications?êÏÑú ?ïÏù∏</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {appsLoading ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  Î∂àÎü¨?§Îäî Ï§?..
                </p>
              ) : myBlocks.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  ?†Ï≤≠??Î∏îÎ°ù???ÜÏäµ?àÎã§.
                </p>
              ) : (
                myBlocks.map((s) => (
                  <div
                    key={s.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-muted/40 px-3 py-2.5"
                  >
                    <div>
                      <p className="text-sm font-medium">{s.eventTitle}</p>
                      <p className="text-xs text-muted-foreground">
                        {s.venue} ¬∑ {s.date} {s.slotTime}
                      </p>
                    </div>
                    <Badge
                      variant={
                        s.status === "approved"
                          ? "success"
                          : s.status === "pending"
                            ? "warning"
                            : s.status === "completed"
                              ? "default"
                              : "destructive"
                      }
                    >
                      {statusLabels[s.status]}
                    </Badge>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <DashboardRecentApplications />
        </div>

        <div className="space-y-6">
          <Card className="xl:sticky xl:top-24">
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle>ÏµúÍ∑º Í≥µÏ?</CardTitle>
              <Link
                href="/notices"
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                ?ÑÏ≤¥ Î≥¥Í∏∞
              </Link>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[220px] pr-3">
                {noticesLoading ? (
                  <p className="py-4 text-center text-sm text-muted-foreground">
                    Î∂àÎü¨?§Îäî Ï§?..
                  </p>
                ) : recentNotices.length === 0 ? (
                  <p className="py-4 text-center text-sm text-muted-foreground">
                    Í≥µÏ? ?ÜÏùå ¬∑ Notices Î©îÎâ¥?êÏÑú ?ïÏù∏?òÏÑ∏??
                  </p>
                ) : (
                  <ul className="space-y-4">
                    {recentNotices.map((n) => (
                      <li key={n.id} className="text-sm">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-medium leading-snug">{n.title}</p>
                          {n.is_important ? (
                            <Badge variant="warning" className="text-[10px] px-1.5 py-0">
                              Ï§ëÏöî
                            </Badge>
                          ) : null}
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {formatNoticeDate(n.created_at)}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </ScrollArea>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Í¥ÄÎ¶¨Ïûê ?åÎ¶º</CardTitle>
              <CardDescription>?¥ÏòÅ ÏΩòÏÜî ?îÏïΩ</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {mockAdminAlerts.length === 0 ? (
                <p className="py-2 text-sm text-muted-foreground">
                  ?åÎ¶º ?ÜÏùå
                </p>
              ) : (
                mockAdminAlerts.map((a) => (
                  <div
                    key={a.id}
                    className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground"
                  >
                    {a.message}
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <Separator className="opacity-60" />
    </div>
  );
}
