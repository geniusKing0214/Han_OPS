import { withBasePath } from "@/lib/base-path";
import type { NotificationItem } from "@/types/notification";

export type AdminRosterLinkParams = {
  date?: string;
  eventId?: string;
  slotTime?: string;
  applicationId?: string;
};

/** Next.js Link / router.push 용 (basePath 미포함 — Next가 자동 처리) */
export function buildAdminRosterPath(params?: AdminRosterLinkParams): string {
  const search = new URLSearchParams();
  if (params?.date) search.set("date", params.date);
  if (params?.eventId) search.set("event", params.eventId);
  if (params?.slotTime) search.set("slot", params.slotTime);
  if (params?.applicationId) search.set("app", params.applicationId);
  const q = search.toString();
  // 신청 인원 관리 메뉴 제거 → 어드민 신청 화면으로 연결
  return q ? `/admin/applications/?${q}` : "/admin/applications/";
}

export function adminRosterPathFromNotification(
  item: Pick<
    NotificationItem,
    "type" | "eventDate" | "eventId" | "slotTime" | "applicationId"
  >,
): string | null {
  if (
    item.type !== "application_submitted" &&
    item.type !== "application_cancelled"
  ) {
    return null;
  }
  return buildAdminRosterPath({
    date: item.eventDate || undefined,
    eventId: item.eventId || undefined,
    slotTime: item.slotTime || undefined,
    applicationId: item.applicationId || undefined,
  });
}

/** 앱 내 네비게이션용 경로 (basePath 없음) */
export function notificationAppPath(item: NotificationItem): string {
  const roster = adminRosterPathFromNotification(item);
  if (roster) return roster;

  if (item.type === "schedule_created" || item.type === "schedule_cancelled") {
    return "/schedule/";
  }
  if (item.type === "application_approved") {
    return "/applications/";
  }
  if (item.type === "notice_posted") {
    return "/notices/";
  }
  if (item.type === "attendance_submitted") {
    return "/admin/attendance/";
  }
  if (
    item.type === "attendance_approved" ||
    item.type === "attendance_rejected"
  ) {
    return "/applications/";
  }
  if (
    item.type === "workforce_confirmed" ||
    item.type === "workforce_updated" ||
    item.type === "workforce_cancelled"
  ) {
    return "/my-assignments/";
  }
  return "/applications/";
}

/** 브라우저/푸시 알림 openWindow 용 (basePath 포함) */
export function notificationHrefFor(item: NotificationItem): string {
  return withBasePath(notificationAppPath(item));
}

/** Cloud Functions / push relay 용 절대 URL */
export function resolveNotificationOpenUrl(
  type: string | undefined,
  fields?: AdminRosterLinkParams,
  options?: { origin?: string; basePath?: string },
): string {
  const origin = (
    options?.origin?.trim() || "https://geniusking0214.github.io"
  ).replace(/\/$/, "");
  const rawBase = options?.basePath?.trim() ?? "/Han_OPS";
  const base =
    !rawBase || rawBase === "/"
      ? ""
      : rawBase.startsWith("/")
        ? rawBase.replace(/\/$/, "")
        : `/${rawBase.replace(/\/$/, "")}`;

  if (type === "schedule_created" || type === "schedule_cancelled") {
    return `${origin}${base}/schedule/`;
  }
  if (type === "application_submitted" || type === "application_cancelled") {
    return `${origin}${base}${buildAdminRosterPath(fields)}`;
  }
  if (type === "application_approved") {
    return `${origin}${base}/applications/`;
  }
  if (type === "notice_posted") {
    return `${origin}${base}/notices/`;
  }
  if (type === "attendance_submitted") {
    return `${origin}${base}/admin/attendance/`;
  }
  if (type === "attendance_approved" || type === "attendance_rejected") {
    return `${origin}${base}/applications/`;
  }
  if (
    type === "workforce_confirmed" ||
    type === "workforce_updated" ||
    type === "workforce_cancelled"
  ) {
    return `${origin}${base}/my-assignments/`;
  }
  return `${origin}${base}/dashboard/`;
}
