import * as admin from "firebase-admin";
import { onDocumentCreated } from "firebase-functions/v2/firestore";

admin.initializeApp();

/** FCM 웹 푸시 대상 알림 (스케줄 생성 → 팀원, 신청 → 관리자) */
const PUSH_NOTIFICATION_TYPES = new Set([
  "schedule_created",
  "application_submitted",
]);

type NotificationDoc = {
  targetUserId?: string;
  title?: string;
  message?: string;
  type?: string;
};

function appBasePath(): string {
  const raw = process.env.APP_BASE_PATH?.trim() ?? "/Han_OPS";
  if (!raw || raw === "/") return "";
  return raw.startsWith("/") ? raw.replace(/\/$/, "") : `/${raw.replace(/\/$/, "")}`;
}

function resolveOpenUrl(type: string | undefined): string {
  const base = appBasePath();
  if (type === "schedule_created") return `${base}/schedule/`;
  if (type === "application_submitted") return `${base}/admin/applications/`;
  return `${base}/`;
}

export const sendPushOnNotification = onDocumentCreated(
  "notifications/{notificationId}",
  async (event) => {
    const data = event.data?.data() as NotificationDoc | undefined;
    if (!data?.targetUserId || !data.type) return;
    if (!PUSH_NOTIFICATION_TYPES.has(data.type)) return;

    const userSnap = await admin
      .firestore()
      .doc(`users/${data.targetUserId}`)
      .get();
    const tokens = (userSnap.data()?.fcmTokens ?? []) as string[];
    const uniqueTokens = [...new Set(tokens.filter((t) => typeof t === "string" && t))];
    if (uniqueTokens.length === 0) return;

    const title = data.title?.trim() || "HAN OPS";
    const body = data.message?.trim() || "";
    const url = resolveOpenUrl(data.type);
    const icon = `${appBasePath()}/icons/icon-192.png`;

    const response = await admin.messaging().sendEachForMulticast({
      tokens: uniqueTokens,
      notification: { title, body },
      data: {
        notificationId: event.params.notificationId,
        type: data.type,
        url,
      },
      webpush: {
        fcmOptions: { link: url },
        notification: {
          title,
          body,
          icon,
        },
      },
    });

    const invalidTokens: string[] = [];
    response.responses.forEach((result, index) => {
      if (result.success) return;
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
