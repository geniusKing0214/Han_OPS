"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CalendarX2,
  CheckCircle2,
  ChevronDown,
  ClipboardList,
  Download,
  Search,
  Star,
  Trophy,
  UserCircle2,
} from "lucide-react";

import { AdminPointAdjustForm } from "@/components/admin/admin-point-adjust-form";
import { useAuth } from "@/components/providers/auth-provider";
import {
  buildRankingRows,
  computeRankingStats,
  exportRankingCsv,
  type RankingRow,
  type RankingScope,
} from "@/lib/admin-ranking";
import {
  subscribeAllApplicationsForAdmin,
  subscribeApplicationsInMonthForAdmin,
} from "@/lib/firestore-applications";
import { subscribePointLogsByMonth, subscribePointLogsByUser } from "@/lib/firestore-points";
import { subscribeAllUsersForAdmin, type ListedUserRow } from "@/lib/firestore-users";
import {
  filterApplicationsMatchingLiveSchedule,
  filterPointLogsMatchingLiveApplications,
} from "@/lib/applications-match-schedule";
import {
  eventsInMonth,
  uniqueEventFilterOptions,
  uniqueVenuesFromEvents,
} from "@/lib/points-filter-options";
import { useEvents } from "@/hooks/use-events";
import type { ApplicationItem } from "@/types/application";
import type { PointLogDoc } from "@/types/points";
import { POINT_POLICY, POINT_TYPE_LABELS } from "@/types/points";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/layout/page-header";

function currentMonthKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${`${d.getMonth() + 1}`.padStart(2, "0")}`;
}

function formatMonthLabel(monthKey: string): string {
  const [y, m] = monthKey.split("-");
  return `${y}년 ${Number(m)}월`;
}

function formatLogDate(iso: string): string {
  try {
    const d = new Date(iso);
    const mm = `${d.getMonth() + 1}`.padStart(2, "0");
    const dd = `${d.getDate()}`.padStart(2, "0");
    return `${mm}/${dd}`;
  } catch {
    return iso.slice(5, 10).replace("-", "/");
  }
}

function rankMedal(rank: number): string | null {
  if (rank === 1) return "🥇";
  if (rank === 2) return "🥈";
  if (rank === 3) return "🥉";
  return null;
}

export function PointsDashboard() {
  const { isAdmin, user, profile } = useAuth();
  const { events } = useEvents();
  const [rankingScope, setRankingScope] = useState<RankingScope>("month");
  const [monthKey, setMonthKey] = useState(currentMonthKey);
  const [venue, setVenue] = useState("");
  const [eventId, setEventId] = useState("");
  const [search, setSearch] = useState("");
  const [applications, setApplications] = useState<ApplicationItem[]>([]);
  const [pointLogs, setPointLogs] = useState<PointLogDoc[]>([]);
  const [users, setUsers] = useState<ListedUserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<RankingRow | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);
  const [userLogs, setUserLogs] = useState<PointLogDoc[]>([]);

  useEffect(() => {
    if (!isAdmin) return;
    setLoading(true);
    setError("");
    const unsubs: (() => void)[] = [
      subscribeAllUsersForAdmin(setUsers, (e) => setError(e.message)),
    ];

    if (rankingScope === "month") {
      unsubs.push(
        subscribeApplicationsInMonthForAdmin(
          monthKey,
          (items) => {
            setApplications(items);
            setLoading(false);
          },
          (e) => {
            setError(e.message);
            setLoading(false);
          },
        ),
        subscribePointLogsByMonth(monthKey, setPointLogs),
      );
    } else {
      unsubs.push(
        subscribeAllApplicationsForAdmin(
          (items) => {
            setApplications(items);
            setLoading(false);
          },
          (e) => {
            setError(e.message);
            setLoading(false);
          },
        ),
      );
      setPointLogs([]);
    }

    return () => unsubs.forEach((u) => u());
  }, [isAdmin, monthKey, rankingScope]);

  useEffect(() => {
    if (!selected?.userId || !isAdmin) {
      setUserLogs([]);
      return;
    }
    return subscribePointLogsByUser(
      selected.userId,
      rankingScope === "month" ? monthKey : null,
      setUserLogs,
    );
  }, [selected?.userId, monthKey, rankingScope, isAdmin]);

  const filterEvents = useMemo(
    () =>
      rankingScope === "month" ? eventsInMonth(events, monthKey) : events,
    [events, monthKey, rankingScope],
  );

  const monthEvents = filterEvents;

  const venues = useMemo(
    () => uniqueVenuesFromEvents(monthEvents),
    [monthEvents],
  );

  const eventOptions = useMemo(
    () => uniqueEventFilterOptions(monthEvents),
    [monthEvents],
  );

  useEffect(() => {
    if (venue && !venues.includes(venue)) setVenue("");
  }, [venue, venues]);

  useEffect(() => {
    if (eventId && !eventOptions.some((o) => o.id === eventId)) setEventId("");
  }, [eventId, eventOptions]);

  const liveApplications = useMemo(
    () => filterApplicationsMatchingLiveSchedule(applications, events),
    [applications, events],
  );

  const livePointLogs = useMemo(
    () => filterPointLogsMatchingLiveApplications(pointLogs, liveApplications),
    [pointLogs, liveApplications],
  );

  const filters = useMemo(
    () => ({
      venue: venue || undefined,
      eventId: eventId || undefined,
      search,
    }),
    [venue, eventId, search],
  );

  const ranking = useMemo(
    () =>
      buildRankingRows(
        users,
        liveApplications,
        livePointLogs,
        filters,
        rankingScope,
      ),
    [users, liveApplications, livePointLogs, filters, rankingScope],
  );

  const stats = useMemo(
    () =>
      computeRankingStats(
        liveApplications,
        livePointLogs,
        users,
        {
          venue: venue || undefined,
          eventId: eventId || undefined,
        },
        rankingScope,
      ),
    [liveApplications, livePointLogs, users, venue, eventId, rankingScope],
  );

  useEffect(() => {
    if (!selected?.userId) return;
    const updated = ranking.find((r) => r.userId === selected.userId);
    if (updated) setSelected(updated);
  }, [ranking, selected?.userId]);

  const selectedUserLogs = useMemo(() => {
    if (!selected?.userId) return [];
    const liveAppIds = new Set(
      liveApplications
        .filter((a) => a.userId === selected.userId)
        .map((a) => a.id),
    );
    return userLogs
      .filter(
        (l) =>
          (l.point_type === "adjustment" && !l.application_id?.trim()) ||
          liveAppIds.has(l.application_id),
      )
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
  }, [userLogs, liveApplications, selected?.userId]);

  const openUserDetail = (row: RankingRow) => {
    setSelected(row);
    const isDesktop =
      typeof window !== "undefined" &&
      window.matchMedia("(min-width: 1024px)").matches;
    if (!isDesktop) {
      setDetailOpen(true);
    }
  };

  const toggleMobileExpand = (userId: string) => {
    setExpandedUserId((prev) => (prev === userId ? null : userId));
  };

  if (!isAdmin) {
    return (
      <p className="text-sm text-muted-foreground">
        관리자만 포인트/랭킹 관리에 접근할 수 있습니다.
      </p>
    );
  }

  const isTotal = rankingScope === "total";

  const statCards = [
    {
      label: isTotal ? "누적 신청" : "총 신청",
      value: stats.totalApplications,
      icon: ClipboardList,
      tone: "text-violet-600",
    },
    {
      label: isTotal ? "누적 승인" : "승인",
      value: stats.approvedCount,
      icon: CheckCircle2,
      tone: "text-blue-600",
    },
    {
      label: isTotal ? "누적 근무완료" : "근무완료",
      value: stats.completedCount,
      icon: CheckCircle2,
      tone: "text-emerald-600",
    },
    {
      label: isTotal ? "누적 결근" : "결근",
      value: stats.noShowCount,
      icon: CalendarX2,
      tone: "text-red-600",
    },
    {
      label: isTotal ? "누적 당일취소" : "당일취소",
      value: stats.lateCancelCount,
      icon: CalendarX2,
      tone: "text-amber-600",
    },
    {
      label: isTotal ? "누적 포인트 합계" : "이번 달 포인트",
      value: `${stats.pointsTotal.toLocaleString()}P`,
      icon: Star,
      tone: "text-accent",
    },
  ];

  const detailBody = selected ? (
    <div className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="flex size-12 items-center justify-center rounded-full bg-muted">
            <UserCircle2 className="size-7 text-muted-foreground" />
          </div>
          <div className="min-w-0">
            <p className="font-semibold">{selected.name}</p>
            <p className="break-all text-xs text-muted-foreground">{selected.email}</p>
            <Badge variant="outline" className="mt-1">
              일반 유저
            </Badge>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-lg border border-accent/30 bg-accent/10 p-3 text-center">
            <p className="text-xs text-muted-foreground">월간 포인트</p>
            <p className="text-lg font-semibold text-accent tabular-nums">
              {selected.monthlyPoints}P
            </p>
          </div>
          <div className="rounded-lg border border-border bg-muted/40 p-3 text-center">
            <p className="text-xs text-muted-foreground">누적 포인트</p>
            <p className="text-lg font-semibold tabular-nums">
              {selected.totalPoints.toLocaleString()}P
            </p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 text-center text-xs">
          <div className="rounded-md bg-muted/40 py-2">
            <p className="text-muted-foreground">{isTotal ? "누적 신청" : "신청"}</p>
            <p className="font-medium tabular-nums">{selected.applicationCount}</p>
          </div>
          <div className="rounded-md bg-muted/40 py-2">
            <p className="text-muted-foreground">{isTotal ? "누적 승인" : "승인"}</p>
            <p className="font-medium tabular-nums">{selected.approvedCount}</p>
          </div>
          <div className="rounded-md bg-muted/40 py-2">
            <p className="text-muted-foreground">
              {isTotal ? "누적 근무완료" : "근무완료"}
            </p>
            <p className="font-medium tabular-nums text-emerald-600">
              {selected.completedCount}
            </p>
          </div>
          <div className="rounded-md bg-muted/40 py-2">
            <p className="text-muted-foreground">{isTotal ? "누적 결근" : "결근"}</p>
            <p className="font-medium tabular-nums text-red-600">
              {selected.noShowCount}
            </p>
          </div>
        </div>
        {user?.uid ? (
          <AdminPointAdjustForm
            userId={selected.userId}
            monthKey={monthKey}
            adminUid={user.uid}
          />
        ) : null}
        <div>
          <p className="mb-2 text-sm font-medium">
            포인트 내역 ({isTotal ? "전체" : formatMonthLabel(monthKey)})
          </p>
          <ScrollArea className="max-h-[min(14rem,38dvh)] pr-2 lg:h-56 lg:max-h-none">
            {selectedUserLogs.length === 0 ? (
              <p className="text-xs text-muted-foreground">내역이 없습니다.</p>
            ) : (
              <ul className="space-y-2">
                {selectedUserLogs.map((log) => (
                  <li
                    key={log.id}
                    className="space-y-1 rounded-md border border-border bg-muted/30 px-2 py-1.5 text-xs"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <Badge
                        variant={
                          log.point_type === "adjustment" ? "accent" : "outline"
                        }
                        className="text-[10px] px-1.5 py-0"
                      >
                        {POINT_TYPE_LABELS[log.point_type]}
                      </Badge>
                      <span
                        className={cn(
                          "shrink-0 font-semibold tabular-nums",
                          log.points >= 0 ? "text-emerald-600" : "text-red-600",
                        )}
                      >
                        {log.points >= 0 ? "+" : ""}
                        {log.points}P
                      </span>
                    </div>
                    <p className="whitespace-pre-wrap leading-snug text-foreground">{log.reason}</p>
                    <p className="text-[10px] text-muted-foreground tabular-nums">
                      {formatLogDate(log.created_at)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </ScrollArea>
        </div>
    </div>
  ) : null;

  const detailPanelDesktop = detailBody ? (
    <Card className="border-border/80 bg-gradient-to-b from-muted/50 to-background lg:sticky lg:top-20">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">유저 상세 정보</CardTitle>
      </CardHeader>
      <CardContent>{detailBody}</CardContent>
    </Card>
  ) : (
    <Card className="hidden border-dashed border-border/80 bg-muted/20 lg:flex lg:min-h-[320px] lg:items-center lg:justify-center">
      <p className="text-sm text-muted-foreground">랭킹에서 유저를 선택하세요</p>
    </Card>
  );

  return (
    <div className="min-w-0 space-y-4 sm:space-y-6">
      <PageHeader
        title="포인트/랭킹 관리"
        description={
          isTotal
            ? "유저별 누적 신청·근무 횟수와 총 포인트를 확인합니다. 순위는 누적 포인트 → 승인 횟수 순입니다."
            : "유저별 신청·근무 현황과 포인트를 확인합니다. 순위는 승인 횟수 → 월간 포인트 순으로 반영됩니다."
        }
        actions={
          <div className="flex shrink-0 items-center gap-2 text-sm text-muted-foreground">
            <span className="hidden max-w-[160px] truncate sm:inline md:max-w-none">
              {profile?.email ?? user?.email}
            </span>
            <Badge variant="accent">관리자</Badge>
          </div>
        }
      />

      <Card className="border-accent/20 bg-muted/20">
        <CardContent className="flex flex-col gap-2 py-3 text-xs text-muted-foreground sm:flex-row sm:flex-wrap sm:gap-4">
          <span>
            근무완료 <strong className="text-emerald-600">+{POINT_POLICY.completed}P</strong>
          </span>
          <span>
            결근 <strong className="text-red-600">{POINT_POLICY.no_show}P</strong>
          </span>
          <span>
            당일취소 <strong className="text-amber-600">{POINT_POLICY.late_cancel}P</strong>
          </span>
          <span className="leading-relaxed">
            신청 시 포인트 미지급 · 동일 건 중복 지급 방지
          </span>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        {statCards.map(({ label, value, icon: Icon, tone }) => (
          <Card
            key={label}
            className="bg-muted/30"
          >
            <CardContent className="space-y-1.5 p-3 sm:space-y-2 sm:p-4">
              <div className="flex items-center justify-between gap-1">
                <p className="text-[11px] text-muted-foreground sm:text-xs">{label}</p>
                <Icon className={cn("size-3.5 shrink-0 sm:size-4", tone)} />
              </div>
              <p className="text-lg font-semibold tabular-nums sm:text-xl">{value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs
        value={rankingScope}
        onValueChange={(v) => setRankingScope(v as RankingScope)}
      >
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="month" className="flex-1 sm:flex-none">
            월간 랭킹
          </TabsTrigger>
          <TabsTrigger value="total" className="flex-1 sm:flex-none">
            누적 랭킹
          </TabsTrigger>
        </TabsList>
      </Tabs>

      <Card>
        <CardContent className="grid grid-cols-1 gap-3 p-3 sm:grid-cols-2 sm:p-4 lg:flex lg:flex-row lg:flex-wrap lg:items-end">
          {rankingScope === "month" ? (
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">월 선택</label>
              <Input
                type="month"
                value={monthKey}
                onChange={(e) => setMonthKey(e.target.value)}
                className="w-full tabular-nums"
              />
            </div>
          ) : null}
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">매장</label>
            <select
              value={venue}
              onChange={(e) => setVenue(e.target.value)}
              className="flex h-9 w-full rounded-md border border-border bg-background px-3 text-sm"
            >
              <option value="">전체</option>
              {venues.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1 sm:col-span-2 lg:col-span-1 lg:min-w-[180px]">
            <label className="text-xs text-muted-foreground">이벤트</label>
            <select
              value={eventId}
              onChange={(e) => setEventId(e.target.value)}
              className="flex h-9 w-full rounded-md border border-border bg-background px-3 text-sm"
            >
              <option value="">전체</option>
              {eventOptions.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1 sm:col-span-2 lg:min-w-[200px] lg:flex-1">
            <label className="text-xs text-muted-foreground">유저 검색</label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="이름, 이메일"
                className="pl-8"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:col-span-2 lg:col-span-full lg:flex lg:w-auto lg:gap-2">
            <Button
              type="button"
              variant="outline"
              className="w-full min-h-9"
              onClick={() => {
                setVenue("");
                setEventId("");
                setSearch("");
              }}
            >
              초기화
            </Button>
            <Button
              type="button"
              variant="accent"
              className="w-full min-h-9 gap-1.5"
              onClick={() => exportRankingCsv(ranking, monthKey, rankingScope)}
              disabled={ranking.length === 0}
            >
              <Download className="size-4 shrink-0" />
              <span className="truncate">엑셀 다운로드</span>
            </Button>
          </div>
        </CardContent>
      </Card>

      {error ? (
        <p className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <Card>
          <CardHeader className="flex flex-row items-center gap-2 pb-3">
            <Trophy className="size-5 text-accent" />
            <CardTitle className="text-base">
              {isTotal
                ? "누적 랭킹 리스트 (전체)"
                : `랭킹 리스트 (${formatMonthLabel(monthKey)})`}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <p className="p-6 text-center text-sm text-muted-foreground">
                불러오는 중...
              </p>
            ) : ranking.length === 0 ? (
              <p className="p-6 text-center text-sm text-muted-foreground">
                표시할 데이터가 없습니다.
              </p>
            ) : (
              <>
                <div className="hidden overflow-x-auto lg:block">
                  <table className="w-full min-w-[720px] text-sm">
                    <thead>
                      <tr className="border-b border-border text-left text-xs text-muted-foreground">
                        <th className="px-4 py-2 font-medium">순위</th>
                        <th className="px-2 py-2 font-medium">이름</th>
                        <th className="px-2 py-2 font-medium">이메일</th>
                        <th className="px-2 py-2 text-right font-medium">
                          {isTotal ? "누적 신청" : "신청"}
                        </th>
                        <th className="px-2 py-2 text-right font-medium">
                          {isTotal ? "누적 승인" : "승인"}
                        </th>
                        <th className="px-2 py-2 text-right font-medium">
                          {isTotal ? "누적 완료" : "완료"}
                        </th>
                        <th className="px-2 py-2 text-right font-medium">
                          {isTotal ? "누적 결근" : "결근"}
                        </th>
                        <th className="px-2 py-2 text-right font-medium">
                          {isTotal ? "누적 당취" : "당취"}
                        </th>
                        {!isTotal ? (
                          <th className="px-2 py-2 text-right font-medium">월간</th>
                        ) : null}
                        <th className="px-4 py-2 text-right font-medium">누적</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ranking.map((row, idx) => {
                        const rank = idx + 1;
                        const active = selected?.userId === row.userId;
                        return (
                          <tr
                            key={row.userId}
                            className={cn(
                              "cursor-pointer border-b border-border/60 transition-colors hover:bg-muted/40",
                              active && "bg-accent/10",
                            )}
                            onClick={() => openUserDetail(row)}
                          >
                            <td className="px-4 py-2.5 tabular-nums">
                              {rankMedal(rank) ?? rank}
                            </td>
                            <td className="max-w-[100px] truncate px-2 py-2.5 font-medium">
                              {row.name}
                            </td>
                            <td className="max-w-[140px] truncate px-2 py-2.5 text-muted-foreground">
                              {row.email}
                            </td>
                            <td className="px-2 py-2.5 text-right tabular-nums">
                              {row.applicationCount}
                            </td>
                            <td className="px-2 py-2.5 text-right tabular-nums">
                              {row.approvedCount}
                            </td>
                            <td className="px-2 py-2.5 text-right tabular-nums text-emerald-600">
                              {row.completedCount}
                            </td>
                            <td className="px-2 py-2.5 text-right tabular-nums text-red-600">
                              {row.noShowCount}
                            </td>
                            <td className="px-2 py-2.5 text-right tabular-nums text-amber-600">
                              {row.lateCancelCount}
                            </td>
                            {!isTotal ? (
                              <td className="px-2 py-2.5 text-right font-medium tabular-nums text-accent">
                                {row.monthlyPoints}P
                              </td>
                            ) : null}
                            <td
                              className={cn(
                                "px-4 py-2.5 text-right tabular-nums",
                                isTotal && "font-medium text-accent",
                              )}
                            >
                              {row.totalPoints.toLocaleString()}P
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="space-y-2 p-2 sm:p-3 lg:hidden">
                  {ranking.map((row, idx) => {
                    const rank = idx + 1;
                    const expanded = expandedUserId === row.userId;
                    return (
                      <div
                        key={row.userId}
                        className={cn(
                          "overflow-hidden rounded-lg border border-border bg-muted/30",
                          expanded && "border-accent/40",
                        )}
                      >
                        <button
                          type="button"
                          className="flex w-full items-start gap-2 p-3 text-left transition-colors active:bg-muted/50"
                          onClick={() => toggleMobileExpand(row.userId)}
                          aria-expanded={expanded}
                        >
                          <ChevronDown
                            className={cn(
                              "mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform",
                              expanded && "rotate-180 text-accent",
                            )}
                          />
                          <div className="min-w-0 flex-1">
                            <span className="text-sm font-medium leading-snug">
                              {rankMedal(rank) ?? `${rank}위`} {row.name}
                            </span>
                            <p className="mt-0.5 truncate text-xs text-muted-foreground">
                              {row.email}
                            </p>
                          </div>
                          <div className="shrink-0 text-right">
                            <p className="text-sm font-semibold text-accent tabular-nums">
                              {isTotal
                                ? `${row.totalPoints.toLocaleString()}P`
                                : `승인 ${row.approvedCount}`}
                            </p>
                            <p className="text-[10px] text-muted-foreground tabular-nums">
                              {isTotal
                                ? `승인 ${row.approvedCount}`
                                : `${row.monthlyPoints}P`}
                            </p>
                          </div>
                        </button>
                        {expanded ? (
                          <div className="space-y-3 border-t border-border px-3 pb-3 pt-2">
                            <div className="grid grid-cols-2 gap-1.5 text-center text-[11px] min-[360px]:grid-cols-3 sm:grid-cols-6 sm:text-xs">
                              <div className="rounded-md bg-background/60 px-1 py-1.5">
                                <p className="text-muted-foreground">
                                  {isTotal ? "누적 신청" : "신청"}
                                </p>
                                <p className="font-medium tabular-nums">
                                  {row.applicationCount}
                                </p>
                              </div>
                              <div className="rounded-md bg-background/60 px-1 py-1.5">
                                <p className="text-muted-foreground">
                                  {isTotal ? "누적 승인" : "승인"}
                                </p>
                                <p className="font-medium tabular-nums">
                                  {row.approvedCount}
                                </p>
                              </div>
                              <div className="rounded-md bg-background/60 px-1 py-1.5">
                                <p className="text-muted-foreground">완료</p>
                                <p className="font-medium tabular-nums text-emerald-600">
                                  {row.completedCount}
                                </p>
                              </div>
                              <div className="rounded-md bg-background/60 px-1 py-1.5">
                                <p className="text-muted-foreground">결근</p>
                                <p className="font-medium tabular-nums text-red-600">
                                  {row.noShowCount}
                                </p>
                              </div>
                              <div className="rounded-md bg-background/60 px-1 py-1.5">
                                <p className="text-muted-foreground">당취</p>
                                <p className="font-medium tabular-nums text-amber-600">
                                  {row.lateCancelCount}
                                </p>
                              </div>
                              <div className="rounded-md bg-background/60 px-1 py-1.5">
                                <p className="text-muted-foreground">누적</p>
                                <p className="font-medium tabular-nums">
                                  {row.totalPoints.toLocaleString()}
                                </p>
                              </div>
                            </div>
                            <Button
                              type="button"
                              variant="accent"
                              className="w-full"
                              onClick={() => openUserDetail(row)}
                            >
                              포인트 지급·차감
                            </Button>
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <div className="hidden lg:block">{detailPanelDesktop}</div>
      </div>

      <Sheet open={detailOpen} onOpenChange={setDetailOpen}>
        <SheetContent side="bottom" className="p-4 pt-6 lg:hidden">
          <SheetHeader className="pr-10 text-left">
            <SheetTitle>유저 상세 · 포인트 조정</SheetTitle>
            <SheetDescription>
              지급·차감 내역은 아래 포인트 내역에 저장됩니다.
            </SheetDescription>
          </SheetHeader>
          <div className="mt-4">{detailBody}</div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
