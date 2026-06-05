import {
  type FirestoreError,
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";

import { db } from "@/lib/firebase";
import { listApprovedMembersByTeamIds } from "@/lib/firestore-users";
import { formatTeamIdsLabel, type TeamId } from "@/types/team";
import type {
  NotificationItem,
  NotificationTargetRole,
  NotificationType,
} from "@/types/notification";

export const NOTIFICATIONS_COLLECTION = "notifications";
const ADMINS_CONFIG_PATH = "config/admins";

function timestampToIso(value: unknown): string {
  if (
    value &&
    typeof value === "object" &&
    "toDate" in value &&
    typeof (value as { toDate: () => Date }).toDate === "function"
  ) {
    return (value as { toDate: () => Date }).toDate().toISOString();
  }
  if (typeof value === "string") return value;
  return new Date().toISOString();
}

function docToNotificationItem(
  id: string,
  data: Record<string, unknown>,
): NotificationItem {
  return {
    id,
    targetUserId:
      typeof data.targetUserId === "string" ? data.targetUserId : "",
    targetEmail:
      typeof data.targetEmail === "string" ? data.targetEmail : undefined,
    targetRole:
      data.targetRole === "admin" || data.targetRole === "member"
        ? data.targetRole
        : "member",
    type: normalizeNotificationType(data.type),
    title: typeof data.title === "string" ? data.title : "",
    message: typeof data.message === "string" ? data.message : "",
    eventId: typeof data.eventId === "string" ? data.eventId : undefined,
    applicationId:
      typeof data.applicationId === "string" ? data.applicationId : undefined,
    eventTitle: typeof data.eventTitle === "string" ? data.eventTitle : "",
    eventDate: typeof data.eventDate === "string" ? data.eventDate : "",
    slotTime: typeof data.slotTime === "string" ? data.slotTime : "",
    location: typeof data.location === "string" ? data.location : "",
    applicantName:
      typeof data.applicantName === "string" ? data.applicantName : undefined,
    applicantEmail:
      typeof data.applicantEmail === "string" ? data.applicantEmail : undefined,
    rejectionReason:
      typeof data.rejectionReason === "string"
        ? data.rejectionReason
        : undefined,
    createdByUserId:
      typeof data.createdByUserId === "string"
        ? data.createdByUserId
        : undefined,
    isRead: data.isRead === true,
    createdAt: timestampToIso(data.createdAt),
    readAt:
      data.readAt && typeof data.readAt === "object"
        ? timestampToIso(data.readAt)
        : typeof data.readAt === "string"
          ? data.readAt
          : undefined,
  };
}

function normalizeNotificationType(value: unknown): NotificationType {
  if (
    value === "application_submitted" ||
    value === "application_approved" ||
    value === "application_rejected" ||
    value === "schedule_created"
  ) {
    return value;
  }
  return "application_submitted";
}

export async function getAdminUidsFromConfig(): Promise<string[]> {
  const snap = await getDoc(doc(db, ADMINS_CONFIG_PATH));
  if (!snap.exists()) return [];
  const data = snap.data() as Record<string, unknown>;
  const uids = data.uids;
  if (!Array.isArray(uids)) return [];
  return uids.filter((u): u is string => typeof u === "string" && u.length > 0);
}

/** 관리자: Firestore users 중 role=admin 인 uid 목록을 config/admins 에 동기화 */
export async function syncAdminUidsConfig(adminUids: string[]) {
  const ref = doc(db, ADMINS_CONFIG_PATH);
  const existing = await getDoc(ref);
  if (existing.exists()) {
    await updateDoc(ref, { uids: adminUids });
  } else {
    await setDoc(ref, { uids: adminUids });
  }
}

type NotificationPayload = {
  targetUserId: string;
  targetEmail?: string;
  targetRole: NotificationTargetRole;
  type: NotificationType;
  title: string;
  message: string;
  eventId?: string;
  applicationId?: string;
  eventTitle: string;
  eventDate: string;
  slotTime: string;
  location: string;
  applicantName?: string;
  applicantEmail?: string;
  rejectionReason?: string;
  createdByUserId?: string;
};

async function createNotificationDoc(payload: NotificationPayload) {
  await addDoc(collection(db, NOTIFICATIONS_COLLECTION), {
    ...payload,
    isRead: false,
    createdAt: serverTimestamp(),
  });
}

export type NotifyApplicationSubmittedInput = {
  applicationId: string;
  createdByUserId: string;
  applicantName: string;
  applicantEmail: string;
  eventId: string;
  eventTitle: string;
  eventDate: string;
  slotTime: string;
  location: string;
};

export async function notifyAdminsOnApplicationSubmitted(
  input: NotifyApplicationSubmittedInput,
) {
  const adminUids = await getAdminUidsFromConfig();
  if (adminUids.length === 0) return;

  const displayName = input.applicantName.trim() || input.applicantEmail;
  const title = "새로운 신청이 도착했어요";
  const message = `${displayName}님이 ${input.eventTitle} 일정을 신청했습니다.`;

  await Promise.all(
    adminUids.map((adminUid) =>
      createNotificationDoc({
        targetUserId: adminUid,
        targetRole: "admin",
        type: "application_submitted",
        title,
        message,
        eventId: input.eventId,
        applicationId: input.applicationId,
        eventTitle: input.eventTitle,
        eventDate: input.eventDate,
        slotTime: input.slotTime,
        location: input.location,
        applicantName: input.applicantName,
        applicantEmail: input.applicantEmail,
        createdByUserId: input.createdByUserId,
      }),
    ),
  );
}

export type NotifyApplicationDecisionInput = {
  targetUserId: string;
  targetEmail?: string;
  applicationId: string;
  eventId?: string;
  eventTitle: string;
  eventDate: string;
  slotTime: string;
  location: string;
  rejectionReason?: string;
};

export async function notifyMemberOnApplicationApproved(
  input: NotifyApplicationDecisionInput,
) {
  await createNotificationDoc({
    targetUserId: input.targetUserId,
    targetEmail: input.targetEmail,
    targetRole: "member",
    type: "application_approved",
    title: "승인 완료",
    message: "신청한 일정이 승인되었습니다.",
    applicationId: input.applicationId,
    eventId: input.eventId,
    eventTitle: input.eventTitle,
    eventDate: input.eventDate,
    slotTime: input.slotTime,
    location: input.location,
  });
}

export async function notifyMemberOnApplicationRejected(
  input: NotifyApplicationDecisionInput,
) {
  const reason = input.rejectionReason?.trim();
  const message = reason
    ? `신청이 거절되었습니다.\n거절 사유: ${reason}`
    : "신청이 거절되었습니다.";

  await createNotificationDoc({
    targetUserId: input.targetUserId,
    targetEmail: input.targetEmail,
    targetRole: "member",
    type: "application_rejected",
    title: "신청 거절",
    message,
    applicationId: input.applicationId,
    eventId: input.eventId,
    eventTitle: input.eventTitle,
    eventDate: input.eventDate,
    slotTime: input.slotTime,
    location: input.location,
    rejectionReason: reason || undefined,
  });
}

export type NotifyScheduleCreatedInput = {
  eventId: string;
  eventTitle: string;
  venue: string;
  teamIds: TeamId[];
  sessions: { date: string; slots: { start_time: string }[] }[];
  createdByUserId: string;
};

function summarizeScheduleSessions(
  sessions: NotifyScheduleCreatedInput["sessions"],
): { eventDate: string; slotTime: string } {
  const sorted = [...sessions].sort((a, b) => a.date.localeCompare(b.date));
  const first = sorted[0];
  if (!first) return { eventDate: "", slotTime: "" };
  const times = [...first.slots]
    .map((s) => s.start_time)
    .filter(Boolean)
    .sort();
  return {
    eventDate: first.date,
    slotTime: times.length > 1 ? `${times[0]} 외 ${times.length - 1}건` : times[0] ?? "",
  };
}

/** 스케줄 생성 시 해당 팀 승인 멤버에게 알림 */
export async function notifyTeamMembersOnScheduleCreated(
  input: NotifyScheduleCreatedInput,
) {
  const members = await listApprovedMembersByTeamIds(input.teamIds);
  if (members.length === 0) return;

  const { eventDate, slotTime } = summarizeScheduleSessions(input.sessions);
  const teamLabel = formatTeamIdsLabel(input.teamIds);
  const title = "새 스케줄이 등록되었어요";
  const datePart = eventDate ? ` · ${eventDate}` : "";
  const timePart = slotTime ? ` ${slotTime}` : "";
  const message = `${input.eventTitle}${datePart}${timePart} · ${input.venue} (${teamLabel})`;

  await Promise.all(
    members.map((member) =>
      createNotificationDoc({
        targetUserId: member.uid,
        targetEmail: member.email,
        targetRole: "member",
        type: "schedule_created",
        title,
        message,
        eventId: input.eventId,
        eventTitle: input.eventTitle,
        eventDate,
        slotTime,
        location: input.venue,
        createdByUserId: input.createdByUserId,
      }),
    ),
  );
}

export function subscribeMyNotifications(
  uid: string,
  onData: (items: NotificationItem[]) => void,
  onError?: (error: FirestoreError) => void,
) {
  const q = query(
    collection(db, NOTIFICATIONS_COLLECTION),
    where("targetUserId", "==", uid),
  );
  return onSnapshot(
    q,
    (snap) => {
      const items = snap.docs
        .map((d) =>
          docToNotificationItem(d.id, d.data() as Record<string, unknown>),
        )
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      onData(items);
    },
    (err) => onError?.(err),
  );
}

export async function markNotificationRead(notificationId: string) {
  const ref = doc(db, NOTIFICATIONS_COLLECTION, notificationId);
  await updateDoc(ref, {
    isRead: true,
    readAt: serverTimestamp(),
  });
}

export async function markAllNotificationsRead(
  items: NotificationItem[],
  uid: string,
) {
  const unread = items.filter((n) => !n.isRead && n.targetUserId === uid);
  if (unread.length === 0) return;
  const batch = writeBatch(db);
  for (const n of unread) {
    batch.update(doc(db, NOTIFICATIONS_COLLECTION, n.id), {
      isRead: true,
      readAt: serverTimestamp(),
    });
  }
  await batch.commit();
}

export async function deleteNotification(notificationId: string) {
  await deleteDoc(doc(db, NOTIFICATIONS_COLLECTION, notificationId));
}
