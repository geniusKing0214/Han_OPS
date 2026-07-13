/* eslint-disable no-undef */
importScripts("https://www.gstatic.com/firebasejs/11.10.0/firebase-app-compat.js");
importScripts(
  "https://www.gstatic.com/firebasejs/11.10.0/firebase-messaging-compat.js",
);
importScripts("./firebase-messaging-config.js");

firebase.initializeApp(self.FIREBASE_MESSAGING_CONFIG);

const messaging = firebase.messaging();
const APP_BASE = typeof self.APP_BASE_PATH === "string" ? self.APP_BASE_PATH : "";

const PUSH_TYPES = new Set([
  "schedule_created",
  "schedule_cancelled",
  "application_submitted",
  "application_approved",
  "notice_posted",
]);

function resolveAbsoluteUrl(pathOrUrl) {
  if (!pathOrUrl) {
    return new URL(`${APP_BASE}/schedule/`, self.location.origin).href;
  }
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  const path = pathOrUrl.startsWith("/") ? pathOrUrl : `${APP_BASE}/${pathOrUrl}`;
  return new URL(path, self.location.origin).href;
}

function iconUrl(size) {
  return new URL(`${APP_BASE}/icons/icon-${size}.png`, self.location.origin).href;
}

messaging.onBackgroundMessage((payload) => {
  showPushNotification(payload);
});

/** iOS PWA: onBackgroundMessage 미호출 시 push 이벤트 폴백 */
self.addEventListener("push", (event) => {
  if (!event.data) return;
  event.waitUntil(
    (async () => {
      try {
        const raw = event.data.json();
        const payload =
          raw && typeof raw === "object" && raw.data
            ? { data: raw.data, notification: raw.notification }
            : { data: raw };
        await showPushNotification(payload);
      } catch {
        // FCM SDK가 이미 처리한 경우 무시
      }
    })(),
  );
});

function showPushNotification(payload) {
  const type = payload.data?.type || "";
  if (!PUSH_TYPES.has(type)) return;

  const title = payload.notification?.title || payload.data?.title || "HAN OPS";
  const body = payload.notification?.body || payload.data?.body || "";
  const url = resolveAbsoluteUrl(payload.data?.url);

  return self.registration.showNotification(title, {
    body,
    icon: iconUrl(192),
    badge: iconUrl(192),
    data: { url, type },
    tag: payload.data?.notificationId || type,
    renotify: true,
    vibrate: [180, 80, 180],
    requireInteraction: false,
  });
}

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || resolveAbsoluteUrl(`${APP_BASE}/dashboard/`);

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if ("focus" in client) {
          if ("navigate" in client) {
            return client.navigate(url).then(() => client.focus());
          }
          client.focus();
          return undefined;
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(url);
      }
      return undefined;
    }),
  );
});
