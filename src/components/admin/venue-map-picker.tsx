"use client";

/**
 * VenueMapPicker
 *
 * Leaflet(CDN) 기반 지도 핀 설정 컴포넌트.
 * 별도 npm 패키지 없이 브라우저에서 Leaflet JS/CSS를 동적 로드합니다.
 *
 * 사용법:
 *   <VenueMapPicker
 *     latitude={v.venueLatitude}
 *     longitude={v.venueLongitude}
 *     radiusMeters={v.allowedRadiusMeters}
 *     onChange={(lat, lon) => { ... }}
 *   />
 */

import { useEffect, useRef, useState } from "react";
import { Loader2, MapPin, Navigation } from "lucide-react";
import { Button } from "@/components/ui/button";

// Leaflet 전역 타입 (런타임에 CDN으로 주입)
declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    L: any;
  }
}

const LEAFLET_CSS =
  "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
const LEAFLET_JS =
  "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";

function loadLeaflet(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof window.L !== "undefined") {
      resolve();
      return;
    }
    // CSS
    if (!document.querySelector(`link[href="${LEAFLET_CSS}"]`)) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = LEAFLET_CSS;
      document.head.appendChild(link);
    }
    // JS
    if (document.querySelector(`script[src="${LEAFLET_JS}"]`)) {
      // 이미 로딩 중 — 완료 대기
      const poll = setInterval(() => {
        if (window.L) {
          clearInterval(poll);
          resolve();
        }
      }, 50);
      return;
    }
    const script = document.createElement("script");
    script.src = LEAFLET_JS;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Leaflet 로드 실패"));
    document.head.appendChild(script);
  });
}

// 한국 중심 기본값
const DEFAULT_LAT = 37.5665;
const DEFAULT_LON = 126.978;
const DEFAULT_ZOOM = 15;

export function VenueMapPicker({
  latitude,
  longitude,
  radiusMeters,
  onChange,
}: {
  latitude: number | null;
  longitude: number | null;
  radiusMeters: number;
  onChange: (lat: number, lon: number) => void;
}) {
  const mapRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const leafletMapRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const markerRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const circleRef = useRef<any>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);
  const [pinned, setPinned] = useState<{ lat: number; lon: number } | null>(
    latitude != null && longitude != null ? { lat: latitude, lon: longitude } : null,
  );

  // ── 지도 초기화 ──
  useEffect(() => {
    let destroyed = false;

    loadLeaflet()
      .then(() => {
        if (destroyed || !mapRef.current) return;
        if (leafletMapRef.current) return; // 이미 초기화됨

        const L = window.L;
        const initLat = latitude ?? DEFAULT_LAT;
        const initLon = longitude ?? DEFAULT_LON;

        const map = L.map(mapRef.current, { zoomControl: true }).setView(
          [initLat, initLon],
          DEFAULT_ZOOM,
        );

        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
          maxZoom: 19,
        }).addTo(map);

        // 클릭 시 핀 설정
        map.on("click", (e: { latlng: { lat: number; lng: number } }) => {
          const { lat, lng: lon } = e.latlng;
          setPin(map, lat, lon);
          onChange(lat, lon);
          setPinned({ lat, lon });
        });

        leafletMapRef.current = map;
        setLoading(false);

        // 이미 좌표가 있으면 핀 표시
        if (latitude != null && longitude != null) {
          setPin(map, latitude, longitude);
        }
      })
      .catch((err: Error) => {
        setError(err.message);
        setLoading(false);
      });

    return () => {
      destroyed = true;
      if (leafletMapRef.current) {
        leafletMapRef.current.remove();
        leafletMapRef.current = null;
        markerRef.current = null;
        circleRef.current = null;
      }
    };
    // 초기화는 마운트 시 1회만
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── 반경 원 업데이트 ──
  useEffect(() => {
    const map = leafletMapRef.current;
    if (!map || !pinned) return;
    updateCircle(map, pinned.lat, pinned.lon, radiusMeters);
  }, [radiusMeters, pinned]);

  function setPin(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    map: any,
    lat: number,
    lon: number,
  ) {
    const L = window.L;
    if (markerRef.current) {
      markerRef.current.setLatLng([lat, lon]);
    } else {
      markerRef.current = L.marker([lat, lon], {
        icon: L.divIcon({
          className: "",
          html: `<div style="
            width:20px;height:20px;
            background:#7c8fff;border:2px solid #fff;
            border-radius:50% 50% 50% 0;
            transform:rotate(-45deg);
            box-shadow:0 2px 6px rgba(0,0,0,0.4)
          "></div>`,
          iconSize: [20, 20],
          iconAnchor: [10, 20],
        }),
      }).addTo(map);
    }
    updateCircle(map, lat, lon, radiusMeters);
  }

  function updateCircle(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    map: any,
    lat: number,
    lon: number,
    radius: number,
  ) {
    const L = window.L;
    if (circleRef.current) {
      circleRef.current.setLatLng([lat, lon]);
      circleRef.current.setRadius(radius);
    } else {
      circleRef.current = L.circle([lat, lon], {
        radius,
        color: "#7c8fff",
        fillColor: "#7c8fff",
        fillOpacity: 0.12,
        weight: 1.5,
      }).addTo(map);
    }
  }

  // ── 내 현재 위치로 이동 ──
  const handleMyLocation = () => {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        const { latitude: lat, longitude: lon } = pos.coords;
        const map = leafletMapRef.current;
        if (!map) return;
        map.setView([lat, lon], DEFAULT_ZOOM);
        setPin(map, lat, lon);
        onChange(lat, lon);
        setPinned({ lat, lon });
      },
      () => setLocating(false),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          지도를 클릭해 장소 핀을 설정하세요
        </span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 gap-1.5 text-xs"
          onClick={handleMyLocation}
          disabled={locating || loading}
        >
          {locating ? (
            <Loader2 className="size-3 animate-spin" />
          ) : (
            <Navigation className="size-3" />
          )}
          내 현재 위치
        </Button>
      </div>

      {/* 지도 컨테이너 */}
      <div className="relative overflow-hidden rounded-lg border border-border">
        {loading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-muted/80">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        )}
        {error && (
          <div className="flex h-48 items-center justify-center text-xs text-red-600">
            {error}
          </div>
        )}
        <div ref={mapRef} style={{ height: 260, width: "100%" }} />
      </div>

      {/* 설정된 좌표 표시 */}
      {pinned ? (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <MapPin className="size-3 text-[#7c8fff]" />
          <span className="tabular-nums">
            {pinned.lat.toFixed(6)}, {pinned.lon.toFixed(6)}
          </span>
          <span className="ml-1 text-muted-foreground/60">· 반경 {radiusMeters}m</span>
        </p>
      ) : (
        <p className="text-xs text-muted-foreground/60">핀이 설정되지 않았습니다</p>
      )}
    </div>
  );
}
