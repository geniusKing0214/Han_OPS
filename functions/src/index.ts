import * as admin from "firebase-admin";
import { logger } from "firebase-functions/v2";
import { onDocumentCreated } from "firebase-functions/v2/firestore";

admin.initializeApp();

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

function resolveOpenUrl(type: string | undefined): string {
  const origin = appOrigin();
  const base = appBasePath();
  if (type === "schedule_created") return `${origin}${base}/schedule/`;
  if (type === "application_submitted") {
    return `${origin}${base}/admin/applications/`;
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
    const url = resolveOpenUrl(data.type);
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
