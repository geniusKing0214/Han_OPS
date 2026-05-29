/** Safari / iOS / 인앱 브라우저 감지 */
export function isSafariOrIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  const ios = /iPad|iPhone|iPod/.test(ua);
  const safari =
    /Safari/i.test(ua) &&
    !/Chrome|CriOS|Chromium|Edg|OPR|FxiOS/i.test(ua);
  return ios || safari;
}

export function isInAppBrowser(): boolean {
  if (typeof navigator === "undefined") return false;
  return /FBAN|FBAV|Instagram|Line|KAKAOTALK|NAVER|DaumApps/i.test(
    navigator.userAgent,
  );
}

/** Firebase Hosting 등 authDomain과 앱 호스트가 같을 때만 redirect 사용 */
export function canUseAuthRedirect(): boolean {
  if (typeof window === "undefined") return false;
  const host = window.location.host;
  return host.endsWith(".firebaseapp.com") || host.endsWith(".web.app");
}

export function shouldPreferGsiSignIn(): boolean {
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID?.trim();
  if (!clientId) return false;
  if (!isSafariOrIOS() && !isInAppBrowser()) return false;
  return !canUseAuthRedirect();
}
