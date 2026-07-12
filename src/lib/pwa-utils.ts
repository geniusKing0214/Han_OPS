import { withBasePath } from "@/lib/base-path";

export function isStandalonePwa(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.matchMedia("(display-mode: fullscreen)").matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export function isIosDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  return (
    /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

export function isAndroidDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Android/i.test(navigator.userAgent);
}

export function isMobileDevice(): boolean {
  return isIosDevice() || isAndroidDevice();
}

/** iOS는 홈 화면(PWA) 설치 후에만 백그라운드 푸시가 안정적입니다. */
export function needsPwaInstallForBackgroundPush(): boolean {
  return isIosDevice() && !isStandalonePwa();
}

export function manifestHref(): string {
  return withBasePath("/manifest.webmanifest");
}

export function appleTouchIconHref(): string {
  return withBasePath("/icons/apple-touch-icon.png");
}
