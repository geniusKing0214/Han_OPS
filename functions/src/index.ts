import * as admin from "firebase-admin";
import { logger } from "firebase-functions/v2";
import { onDocumentCreated, onDocumentUpdated } from "firebase-functions/v2/firestore";
import { onSchedule } from "firebase-functions/v2/scheduler";

admin.initializeApp();

const PUSH_NOTIFICATION_TYPES = new Set([
  "schedule_created",
  "schedule_cancelled",
  "application_submitted",
  "application_cancelled",
  "application_approved",
  "notice_posted",
  "attendance_submitted",
  "attendance_approved",
  "attendance_rejected",
]);

type NotificationDoc = {
  targetUserId?: string;
  title?: string;
  message?: string;
  type?: string;
  eventId?: string;
  eventDate?: string;
  slotTime?: string;
  applicationId?: string;
};

function appOrigin(): string {
  return (
    process.env.APP_ORIGIN?.trim() || "https://geniusking0214.github.io"
  ).replace(/\/$/, "");
}

function appBasePath(): string {
  const raw = process.env.APP_BASE_PATH?.trim() ?? "/Han_OPS";
  if (!raw || raw === "/") return "";
  return raw.startsWith("/") ? raw.replace(/\/$/, "") : `/${raw.replace(/\/$/, "")}`;
}

function buildAdminRosterPath(fields?: {
  date?: string;
  eventId?: string;
  slotTime?: string;
  applicationId?: string;
}): string {
  const search = new URLSearchParams();
  if (fields?.date) search.set("date", fields.date);
  if (fields?.eventId) search.set("event", fields.eventId);
  if (fields?.slotTime) search.set("slot", fields.slotTime);
  if (fields?.applicationId) search.set("app", fields.applicationId);
  const q = search.toString();
  return `/admin/roster${q ? `?${q}` : ""}`;
}

function resolveOpenUrl(data: NotificationDoc): string {
  const origin = appOrigin();
  const base = appBasePath();
  const type = data.type;
  if (type === "schedule_created" || type === "schedule_cancelled") {
    return `${origin}${base}/schedule/`;
  }
  if (type === "application_submitted" || type === "application_cancelled") {
    const path = buildAdminRosterPath({
      date: data.eventDate,
      eventId: data.eventId,
      slotTime: data.slotTime,
      applicationId: data.applicationId,
    });
    return `${origin}${base}${path}/`;
  }
  if (type === "application_approved") {
    return `${origin}${base}/applications/`;
  }
  if (type === "notice_posted") {
    return `${origin}${base}/notices/`;
  }
  if (
    type === "attendance_submitted" ||
    type === "attendance_approved" ||
    type === "attendance_rejected"
  ) {
    return type === "attendance_submitted"
      ? `${origin}${base}/admin/attendance/`
      : `${origin}${base}/applications/`;
  }
  return `${origin}${base}/dashboard/`;
}

export const sendPushOnNotification = onDocumentCreated(
  "notifications/{notificationId}",
  async (event) => {
    const data = event.data?.data() as NotificationDoc | undefined;
    const notificationId = event.params.notificationId;

    if (!data?.targetUserId || !data.type) {
      logger.warn("skip: missing targetUserId or type", { notificationId });
      return;
    }
    if (!PUSH_NOTIFICATION_TYPES.has(data.type)) {
      logger.info("skip: not a push type", { type: data.type, notificationId });
      return;
    }

    const userSnap = await admin
      .firestore()
      .doc(`users/${data.targetUserId}`)
      .get();
    const tokens = (userSnap.data()?.fcmTokens ?? []) as string[];
    const uniqueTokens = [...new Set(tokens.filter((t) => typeof t === "string" && t))];

    if (uniqueTokens.length === 0) {
      logger.warn("skip: no fcmTokens", {
        notificationId,
        targetUserId: data.targetUserId,
        type: data.type,
      });
      return;
    }

    const title = data.title?.trim() || "HAN OPS";
    const body = data.message?.trim() || "";
    const url = resolveOpenUrl(data);
    const icon = `${appOrigin()}${appBasePath()}/icons/icon-192.png`;

    logger.info("sending push", {
      notificationId,
      targetUserId: data.targetUserId,
      type: data.type,
      tokenCount: uniqueTokens.length,
      url,
    });

    const response = await admin.messaging().sendEachForMulticast({
      tokens: uniqueTokens,
      notification: { title, body },
      data: {
        notificationId,
        type: data.type,
        url,
        title,
        body,
      },
      webpush: {
        fcmOptions: { link: url },
        notification: { title, body, icon },
      },
    });

    logger.info("push result", {
      notificationId,
      success: response.successCount,
      failure: response.failureCount,
    });

    const invalidTokens: string[] = [];
    response.responses.forEach((result, index) => {
      if (result.success) return;
      logger.warn("push token failed", {
        code: result.error?.code,
        message: result.error?.message,
      });
      const code = result.error?.code ?? "";
      if (
        code === "messaging/invalid-registration-token" ||
        code === "messaging/registration-token-not-registered"
      ) {
        invalidTokens.push(uniqueTokens[index]);
      }
    });

    if (invalidTokens.length === 0) return;

    await admin
      .firestore()
      .doc(`users/${data.targetUserId}`)
      .update({
        fcmTokens: admin.firestore.FieldValue.arrayRemove(...invalidTokens),
      });
  },
);

/** 관리자 확인/반려 시 서버 시각으로 photoDeleteAt(+24h) 설정 */
export const onAttendanceReviewed = onDocumentUpdated(
  "attendances/{attendanceId}",
  async (event) => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();
    if (!before || !after) return;

    const becameReviewed =
      before.reviewStatus !== after.reviewStatus &&
      (after.reviewStatus === "approved" || after.reviewStatus === "rejected");

    if (!becameReviewed) return;

    const hintMs =
      typeof after.photoDeleteAtHintMs === "number"
        ? after.photoDeleteAtHintMs
        : 24 * 60 * 60 * 1000;
    const deleteAt = admin.firestore.Timestamp.fromMillis(Date.now() + hintMs);

    await event.data?.after.ref.update({
      photoDeleteAt: deleteAt,
      reviewedAt: admin.firestore.FieldValue.serverTimestamp(),
      photoStatus:
        typeof after.storagePath === "string" && after.storagePath
          ? "scheduled_for_deletion"
          : "none",
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    logger.info("attendance review timestamps set", {
      attendanceId: event.params.attendanceId,
      reviewStatus: after.reviewStatus,
    });
  },
);

/** 1시간마다 삭제 예정 사진만 제거 (메타데이터·출근 기록 유지) */
export const cleanupAttendancePhotos = onSchedule("every 60 minutes", async () => {
  const db = admin.firestore();
  const now = admin.firestore.Timestamp.now();
  const snap = await db
    .collection("attendances")
    .where("photoStatus", "in", ["scheduled_for_deletion", "deletion_failed"])
    .where("photoDeleteAt", "<=", now)
    .limit(50)
    .get();

  if (snap.empty) {
    logger.info("cleanupAttendancePhotos: nothing to delete");
    return;
  }

  const bucket = admin.storage().bucket();

  for (const docSnap of snap.docs) {
    const data = docSnap.data();
    const storagePath =
      typeof data.storagePath === "string" ? data.storagePath : "";
    try {
      if (storagePath) {
        await bucket.file(storagePath).delete({ ignoreNotFound: true });
      }
      await docSnap.ref.update({
        photoUrl: null,
        storagePath: null,
        photoStatus: "deleted",
        photoDeletedAt: admin.firestore.FieldValue.serverTimestamp(),
        photoDeletionError: null,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      logger.info("attendance photo deleted", { id: docSnap.id, storagePath });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const retry =
        typeof data.photoDeletionRetryCount === "number"
          ? data.photoDeletionRetryCount + 1
          : 1;
      await docSnap.ref.update({
        photoStatus: "deletion_failed",
        photoDeletionError: message.slice(0, 500),
        photoDeletionRetryCount: retry,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      logger.error("attendance photo delete failed", {
        id: docSnap.id,
        message,
      });
    }
  }
});
