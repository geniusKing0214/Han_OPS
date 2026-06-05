import * as admin from "firebase-admin";
import { onDocumentCreated } from "firebase-functions/v2/firestore";

admin.initializeApp();

type NotificationDoc = {
  targetUserId?: string;
  title?: string;
  message?: string;
  type?: string;
};

function resolveOpenUrl(type: string | undefined): string {
  if (type === "schedule_created") return "/schedule";
  if (type === "application_submitted") return "/admin/applications";
  return "/applications";
}

export const sendPushOnNotification = onDocumentCreated(
  "notifications/{notificationId}",
  async (event) => {
    const data = event.data?.data() as NotificationDoc | undefined;
    if (!data?.targetUserId) return;

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

    const response = await admin.messaging().sendEachForMulticast({
      tokens: uniqueTokens,
      notification: { title, body },
      data: {
        notificationId: event.params.notificationId,
        type: data.type ?? "",
        url,
      },
      webpush: {
        fcmOptions: { link: url },
        notification: {
          title,
          body,
          icon: "/icons/icon-192.svg",
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
