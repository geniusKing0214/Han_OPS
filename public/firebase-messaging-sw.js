/* eslint-disable no-undef */
importScripts("https://www.gstatic.com/firebasejs/11.10.0/firebase-app-compat.js");
importScripts(
  "https://www.gstatic.com/firebasejs/11.10.0/firebase-messaging-compat.js",
);
importScripts("./firebase-messaging-config.js");

firebase.initializeApp(self.FIREBASE_MESSAGING_CONFIG);

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const title = payload.notification?.title || "HAN OPS";
  const body = payload.notification?.body || "";
  const url = payload.data?.url || "/schedule";

  self.registration.showNotification(title, {
    body,
    icon: "./icons/icon-192.svg",
    badge: "./icons/icon-192.svg",
    data: { url },
    tag: payload.data?.notificationId || undefined,
  });
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/schedule";
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if ("focus" in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(url);
      }
      return undefined;
    }),
  );
});
