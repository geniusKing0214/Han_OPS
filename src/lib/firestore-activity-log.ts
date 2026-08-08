import {
  type FirestoreError,
  addDoc,
  collection,
  limit,
  onSnapshot,
  orderBy,
  query,
} from "firebase/firestore";

import { db } from "@/lib/firebase";

export const ACTIVITY_LOGS_COLLECTION = "activityLogs";

export type ActivityLogAction =
  | "application_approved"
  | "application_rejected"
  | "application_cancel_approved"
  | "application_cancel_rejected"
  | "schedule_created"
  | "schedule_deleted";

export const ACTIVITY_LOG_LABELS: Record<ActivityLogAction, string> = {
  application_approved: "신청 승인",
  application_rejected: "신청 거절",
  application_cancel_approved: "취소 요청 승인",
  application_cancel_rejected: "취소 요청 거절",
  schedule_created: "스케줄 등록",
  schedule_deleted: "스케줄 삭제",
};

export type ActivityLogItem = {
  id: string;
  action: ActivityLogAction;
  actorUserId: string;
  targetUserId?: string;
  targetUserName?: string;
  eventTitle?: string;
  detail?: string;
  createdAt: string;
};

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

/** 관리자 승인/거절/취소 처리, 스케줄 등록/삭제 이력을 남긴다. */
export async function writeActivityLog(input: {
  action: ActivityLogAction;
  actorUserId: string;
  targetUserId?: string;
  targetUserName?: string;
  eventTitle?: string;
  detail?: string;
}): Promise<void> {
  const payload: Record<string, unknown> = {
    action: input.action,
    actorUserId: input.actorUserId,
    createdAt: new Date().toISOString(),
  };
  if (input.targetUserId) payload.targetUserId = input.targetUserId;
  if (input.targetUserName) payload.targetUserName = input.targetUserName;
  if (input.eventTitle) payload.eventTitle = input.eventTitle;
  if (input.detail) payload.detail = input.detail;
  await addDoc(collection(db, ACTIVITY_LOGS_COLLECTION), payload);
}

export function subscribeActivityLogs(
  onData: (rows: ActivityLogItem[]) => void,
  onError?: (e: FirestoreError) => void,
  max = 200,
) {
  const q = query(
    collection(db, ACTIVITY_LOGS_COLLECTION),
    orderBy("createdAt", "desc"),
    limit(max),
  );
  return onSnapshot(
    q,
    (snap) => {
      const rows = snap.docs.map((d) => {
        const data = d.data() as Record<string, unknown>;
        return {
          id: d.id,
          action: (data.action as ActivityLogAction) ?? "application_approved",
          actorUserId:
            typeof data.actorUserId === "string" ? data.actorUserId : "",
          targetUserId:
            typeof data.targetUserId === "string" ? data.targetUserId : undefined,
          targetUserName:
            typeof data.targetUserName === "string"
              ? data.targetUserName
              : undefined,
          eventTitle:
            typeof data.eventTitle === "string" ? data.eventTitle : undefined,
          detail: typeof data.detail === "string" ? data.detail : undefined,
          createdAt: timestampToIso(data.createdAt),
        } satisfies ActivityLogItem;
      });
      onData(rows);
    },
    (err) => onError?.(err),
  );
}
