/** Haversine distance in meters */
export function haversineMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}

export function getCurrentPosition(options?: PositionOptions): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      reject(new Error("이 기기에서 GPS를 사용할 수 없습니다."));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 20000,
      maximumAge: 0,
      ...options,
    });
  });
}

export function watchPosition(
  onUpdate: (pos: GeolocationPosition) => void,
  onError?: (err: GeolocationPositionError) => void,
  options?: PositionOptions,
): () => void {
  if (typeof navigator === "undefined" || !navigator.geolocation) {
    return () => {};
  }
  const id = navigator.geolocation.watchPosition(onUpdate, onError, {
    enableHighAccuracy: true,
    timeout: 20000,
    maximumAge: 3000,
    ...options,
  });
  return () => navigator.geolocation.clearWatch(id);
}

// ================================================================
// Mock Location 감지
// ================================================================

export type GpsReading = {
  latitude: number;
  longitude: number;
  accuracy: number;
  timestamp: number; // ms (GeolocationPosition.timestamp)
};

export type MockLocationSignal = {
  suspicious: boolean;
  reasons: string[];
  riskLevel: "none" | "low" | "medium" | "high";
};

/** 사람이 이동할 수 있는 최대 속도 (m/s) — 60 km/h */
const MAX_HUMAN_SPEED_MS = 16.7;
/** mock GPS 앱이 고정 정확도 값으로 자주 반환하는 임계 (m) */
const PERFECT_ACCURACY_THRESHOLD = 5;

export class GpsSessionTracker {
  private readings: GpsReading[] = [];

  addReading(pos: GeolocationPosition): void {
    this.readings.push({
      latitude: pos.coords.latitude,
      longitude: pos.coords.longitude,
      accuracy: pos.coords.accuracy,
      timestamp: pos.timestamp,
    });
    if (this.readings.length > 20) this.readings.shift();
  }

  detectMockLocation(): MockLocationSignal {
    const reasons: string[] = [];

    if (this.readings.length < 3) {
      return { suspicious: false, reasons: [], riskLevel: "none" };
    }

    // ① 비정상 이동 속도
    for (let i = 1; i < this.readings.length; i++) {
      const prev = this.readings[i - 1];
      const curr = this.readings[i];
      const dtSec = (curr.timestamp - prev.timestamp) / 1000;
      if (dtSec <= 0) continue;
      const dist = haversineMeters(
        prev.latitude, prev.longitude,
        curr.latitude, curr.longitude,
      );
      const speed = dist / dtSec;
      if (speed > MAX_HUMAN_SPEED_MS) {
        reasons.push(`비정상 이동 속도 (${Math.round(speed * 3.6)} km/h)`);
        break;
      }
    }

    // ② 정확도 값이 변화 없이 고정 (mock GPS 특징)
    const accuracies = this.readings.map((r) => r.accuracy);
    const uniqueAcc = new Set(accuracies.map((a) => Math.round(a)));
    if (uniqueAcc.size === 1 && Math.max(...accuracies) <= PERFECT_ACCURACY_THRESHOLD) {
      reasons.push("GPS 정확도 값이 변화 없이 고정됨 (fake GPS 의심)");
    }

    // ③ 30초 이상 좌표 무변화 (실내 또는 위치 고정)
    const timeSpanSec =
      (this.readings[this.readings.length - 1].timestamp - this.readings[0].timestamp) / 1000;
    const latRange =
      Math.max(...this.readings.map((r) => r.latitude)) -
      Math.min(...this.readings.map((r) => r.latitude));
    const lonRange =
      Math.max(...this.readings.map((r) => r.longitude)) -
      Math.min(...this.readings.map((r) => r.longitude));
    if (latRange === 0 && lonRange === 0 && timeSpanSec > 30) {
      reasons.push("30초 이상 좌표 무변화 (위치 고정 의심)");
    }

    const riskLevel: MockLocationSignal["riskLevel"] =
      reasons.length >= 2 ? "high"
      : reasons.length === 1 ? "medium"
      : "none";

    return { suspicious: reasons.length > 0, reasons, riskLevel };
  }

  get latestReading(): GpsReading | undefined {
    return this.readings[this.readings.length - 1];
  }

  reset(): void {
    this.readings = [];
  }
}
