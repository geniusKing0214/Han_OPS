import { withBasePath } from "@/lib/base-path";
import type { NotificationItem } from "@/types/notification";

export type AdminRosterLinkParams = {
  date?: string;
  eventId?: string;
  slotTime?: string;
  applicationId?: string;
};

export function buildAdminRosterPath(params?: AdminRosterLinkParams): string {
  const search = new URLSearchParams();
  if (params?.date) search.set("date", params.date);
  if (params?.eventId) search.set("event", params.eventId);
  if (params?.slotTime) search.set("slot", params.slotTime);
  if (params?.applicationId) search.set("app", params.applicationId);
  const q = search.toString();
  return `/admin/roster${q ? `?${q}` : ""}`;
}

export function adminRosterHref(params?: AdminRosterLinkParams): string {
  return withBasePath(buildAdminRosterPath(params));
}

export function adminRosterHrefFromNotification(
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
  return adminRosterHref({
    date: item.eventDate || undefined,
    eventId: item.eventId || undefined,
    slotTime: item.slotTime || undefined,
    applicationId: item.applicationId || undefined,
  });
}

export function notificationHrefFor(item: NotificationItem): string {
  const roster = adminRosterHrefFromNotification(item);
  if (roster) return roster;

  if (item.type === "schedule_created" || item.type === "schedule_cancelled") {
    return withBasePath("/schedule");
  }
  if (item.type === "application_approved") {
    return withBasePath("/applications");
  }
  if (item.type === "notice_posted") {
    return withBasePath("/notices");
  }
  if (item.type === "attendance_submitted") {
    return withBasePath("/admin/attendance");
  }
  if (
    item.type === "attendance_approved" ||
    item.type === "attendance_rejected"
  ) {
    return withBasePath("/applications");
  }
  return withBasePath("/applications");
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
    const path = buildAdminRosterPath(fields);
    return `${origin}${base}${path}/`;
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
  return `${origin}${base}/dashboard/`;
}
