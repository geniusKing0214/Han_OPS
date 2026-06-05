/** Safari(비 PWA) 등 Notification API 가 없는 환경에서도 안전하게 동작 */
export function getNotificationPermission(): NotificationPermission {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return "denied";
  }
  return Notification.permission;
}

export function hasNotificationApi(): boolean {
  return typeof window !== "undefined" && "Notification" in window;
}
