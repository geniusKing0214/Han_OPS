import type { ApplicationItem } from "@/types/application";
import type { PointLogDoc } from "@/types/points";
import type { ListedUserRow } from "@/lib/firestore-users";

export type RankingRow = {
  userId: string;
  name: string;
  email: string;
  applicationCount: number;
  approvedCount: number;
  completedCount: number;
  noShowCount: number;
  lateCancelCount: number;
  monthlyPoints: number;
  totalPoints: number;
};

export type MonthStats = {
  totalApplications: number;
  approvedCount: number;
  completedCount: number;
  noShowCount: number;
  lateCancelCount: number;
  monthlyPointsTotal: number;
};

export function buildRankingRows(
  users: ListedUserRow[],
  applications: ApplicationItem[],
  pointLogs: PointLogDoc[],
  filters: {
    venue?: string;
    eventId?: string;
    search?: string;
  },
): RankingRow[] {
  const venueFilter = filters.venue?.trim();
  const eventFilter = filters.eventId?.trim();
  const search = filters.search?.trim().toLowerCase() ?? "";

  const filteredApps = applications.filter((a) => {
    if (venueFilter && a.venue !== venueFilter) return false;
    if (eventFilter && a.eventId !== eventFilter) return false;
    return true;
  });

  const monthlyByUser = new Map<string, number>();
  for (const log of pointLogs) {
    monthlyByUser.set(
      log.user_id,
      (monthlyByUser.get(log.user_id) ?? 0) + log.points,
    );
  }

  const appStats = new Map<
    string,
    {
      applicationCount: number;
      approvedCount: number;
      completedCount: number;
      noShowCount: number;
      lateCancelCount: number;
    }
  >();

  for (const a of filteredApps) {
    const uid = a.userId?.trim();
    if (!uid) continue;
    const s = appStats.get(uid) ?? {
      applicationCount: 0,
      approvedCount: 0,
      completedCount: 0,
      noShowCount: 0,
      lateCancelCount: 0,
    };
    s.applicationCount += 1;
    if (a.status === "approved" || a.status === "completed") {
      s.approvedCount += 1;
    }
    if (a.workStatus === "completed") s.completedCount += 1;
    if (a.workStatus === "no_show") s.noShowCount += 1;
    if (a.workStatus === "late_cancel") s.lateCancelCount += 1;
    appStats.set(uid, s);
  }

  const userIds = new Set<string>([
    ...users.map((u) => u.uid),
    ...appStats.keys(),
    ...monthlyByUser.keys(),
  ]);

  const rows: RankingRow[] = [];

  for (const uid of userIds) {
    const user = users.find((u) => u.uid === uid);
    const name = user?.displayName?.trim() || "—";
    const email = user?.email?.trim() || "—";
    if (search) {
      const hay = `${name} ${email}`.toLowerCase();
      if (!hay.includes(search)) continue;
    }
    const stats = appStats.get(uid) ?? {
      applicationCount: 0,
      approvedCount: 0,
      completedCount: 0,
      noShowCount: 0,
      lateCancelCount: 0,
    };
    rows.push({
      userId: uid,
      name,
      email,
      ...stats,
      monthlyPoints: monthlyByUser.get(uid) ?? 0,
      totalPoints:
        typeof user?.total_points === "number" ? user.total_points : 0,
    });
  }

  return rows.sort((a, b) => {
    if (b.monthlyPoints !== a.monthlyPoints) {
      return b.monthlyPoints - a.monthlyPoints;
    }
    return a.name.localeCompare(b.name, "ko");
  });
}

export function computeMonthStats(
  applications: ApplicationItem[],
  pointLogs: PointLogDoc[],
  filters: { venue?: string; eventId?: string },
): MonthStats {
  const venueFilter = filters.venue?.trim();
  const eventFilter = filters.eventId?.trim();
  const filteredApps = applications.filter((a) => {
    if (venueFilter && a.venue !== venueFilter) return false;
    if (eventFilter && a.eventId !== eventFilter) return false;
    return true;
  });

  let approvedCount = 0;
  let completedCount = 0;
  let noShowCount = 0;
  let lateCancelCount = 0;

  for (const a of filteredApps) {
    if (a.status === "approved" || a.status === "completed") approvedCount += 1;
    if (a.workStatus === "completed") completedCount += 1;
    if (a.workStatus === "no_show") noShowCount += 1;
    if (a.workStatus === "late_cancel") lateCancelCount += 1;
  }

  const appIds = new Set(filteredApps.map((a) => a.id));
  const monthlyPointsTotal = pointLogs
    .filter((l) => appIds.has(l.application_id) || !eventFilter)
    .reduce((sum, l) => sum + l.points, 0);

  return {
    totalApplications: filteredApps.length,
    approvedCount,
    completedCount,
    noShowCount,
    lateCancelCount,
    monthlyPointsTotal: eventFilter
      ? pointLogs
          .filter((l) => {
            const app = filteredApps.find((a) => a.id === l.application_id);
            return Boolean(app);
          })
          .reduce((s, l) => s + l.points, 0)
      : pointLogs.reduce((s, l) => s + l.points, 0),
  };
}

export function exportRankingCsv(rows: RankingRow[], monthLabel: string): void {
  const header = [
    "순위",
    "이름",
    "이메일",
    "신청 횟수",
    "승인 횟수",
    "근무완료 횟수",
    "결근 횟수",
    "당일취소 횟수",
    "월간 포인트",
    "누적 포인트",
  ];
  const lines = rows.map((r, i) =>
    [
      i + 1,
      r.name,
      r.email,
      r.applicationCount,
      r.approvedCount,
      r.completedCount,
      r.noShowCount,
      r.lateCancelCount,
      r.monthlyPoints,
      r.totalPoints,
    ]
      .map((c) => `"${String(c).replace(/"/g, '""')}"`)
      .join(","),
  );
  const bom = "\uFEFF";
  const csv = bom + [header.join(","), ...lines].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `han-ops-ranking-${monthLabel}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
