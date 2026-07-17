import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  type Timestamp,
} from "firebase/firestore";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";

import { compressAttendancePhoto } from "@/lib/attendance-image";
import {
  getCurrentPosition,
  haversineMeters,
  type MockLocationSignal,
} from "@/lib/attendance-geo";
import { parseAttendanceSettings } from "@/lib/attendance-settings";
import {
  computeLocationStatus,
  computeTimeStatus,
  getCheckInWindow,
  isWithinCheckInWindow,
  scheduledCheckInDate,
} from "@/lib/attendance-window";
import { db, storage } from "@/lib/firebase";
import {
  notifyAdminsOnAttendanceSubmitted,
  notifyMemberOnAttendanceReviewed,
} from "@/lib/firestore-notifications";
import type { ApplicationItem } from "@/types/application";
import type {
  AttendanceRecord,
  AttendanceReviewStatus,
  AttendanceSettings,
} from "@/types/attendance";
import type { EventItem } from "@/types/schedule";
import { normalizeTeamId } from "@/lib/team-utils";
import type { TeamId } from "@/types/team";

export const ATTENDANCES_COLLECTION = "attendances";

function tsToIso(v: unknown): string {
  if (
    v &&
    typeof v === "object" &&
    "toDate" in v &&
    typeof (v as Timestamp).toDate === "function"
  ) {
    return (v as Timestamp).toDate().toISOString();
  }
  if (typeof v === "string") return v;
  return "";
}

function docToAttendance(
  id: string,
  data: Record<string, unknown>,
): AttendanceRecord | null {
  if (typeof data.userId !== "string" || typeof data.applicationId !== "string") {
    return null;
  }
  return {
    id,
    userId: data.userId,
    userName: typeof data.userName === "string" ? data.userName : "",
    teamId: normalizeTeamId(data.teamId as TeamId | undefined),
    applicationId: data.applicationId,
    eventId: typeof data.eventId === "string" ? data.eventId : "",
    eventName: typeof data.eventName === "string" ? data.eventName : "",
    workDate: typeof data.workDate === "string" ? data.workDate : "",
    slotTime: typeof data.slotTime === "string" ? data.slotTime : "",
    venue: typeof data.venue === "string" ? data.venue : "",
    scheduledCheckInAt: tsToIso(data.scheduledCheckInAt) || "",
    actualCheckInAt: tsToIso(data.actualCheckInAt) || "",
    latitude: typeof data.latitude === "number" ? data.latitude : null,
    longitude: typeof data.longitude === "number" ? data.longitude : null,
    accuracy: typeof data.accuracy === "number" ? data.accuracy : null,
    venueLatitude:
      typeof data.venueLatitude === "number" ? data.venueLatitude : null,
    venueLongitude:
      typeof data.venueLongitude === "number" ? data.venueLongitude : null,
    distanceFromVenueMeters:
      typeof data.distanceFromVenueMeters === "number"
        ? data.distanceFromVenueMeters
        : null,
    timeStatus:
      data.timeStatus === "late" ||
      data.timeStatus === "very_late" ||
      data.timeStatus === "admin_modified"
        ? data.timeStatus
        : "normal",
    locationStatus:
      data.locationStatus === "outside_radius" ||
      data.locationStatus === "location_unavailable" ||
      data.locationStatus === "low_accuracy" ||
      data.locationStatus === "not_required"
        ? data.locationStatus
        : "inside_radius",
    photoUrl: typeof data.photoUrl === "string" ? data.photoUrl : null,
    storagePath: typeof data.storagePath === "string" ? data.storagePath : null,
    reviewStatus:
      data.reviewStatus === "approved" ||
      data.reviewStatus === "rejected" ||
      data.reviewStatus === "none"
        ? data.reviewStatus
        : "pending",
    reviewedBy: typeof data.reviewedBy === "string" ? data.reviewedBy : null,
    reviewedAt: tsToIso(data.reviewedAt) || null,
    adminMemo: typeof data.adminMemo === "string" ? data.adminMemo : "",
    rejectionReason:
      typeof data.rejectionReason === "string" ? data.rejectionReason : null,
    photoDeleteAt: tsToIso(data.photoDeleteAt) || null,
    photoDeletedAt: tsToIso(data.photoDeletedAt) || null,
    photoStatus:
      data.photoStatus === "scheduled_for_deletion" ||
      data.photoStatus === "deleted" ||
      data.photoStatus === "deletion_failed" ||
      data.photoStatus === "none"
        ? data.photoStatus
        : "active",
    photoDeletionError:
      typeof data.photoDeletionError === "string"
        ? data.photoDeletionError
        : null,
    photoDeletionRetryCount:
      typeof data.photoDeletionRetryCount === "number"
        ? data.photoDeletionRetryCount
        : 0,
    previousAttendanceId:
      typeof data.previousAttendanceId === "string"
        ? data.previousAttendanceId
        : null,
    attempt: typeof data.attempt === "number" ? data.attempt : 1,
    createdAt: tsToIso(data.createdAt) || "",
    updatedAt: tsToIso(data.updatedAt) || "",
  };
}

export function subscribeMyAttendances(
  userId: string,
  onNext: (rows: AttendanceRecord[]) => void,
  onError?: (message: string) => void,
) {
  const q = query(
    collection(db, ATTENDANCES_COLLECTION),
    where("userId", "==", userId),
  );
  return onSnapshot(
    q,
    (snap) => {
      const list: AttendanceRecord[] = [];
      for (const d of snap.docs) {
        const row = docToAttendance(d.id, d.data() as Record<string, unknown>);
        if (row) list.push(row);
      }
      list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      onNext(list);
    },
    (err) => onError?.(err.message),
  );
}

export function subscribeAttendancesByWorkDate(
  workDate: string,
  onNext: (rows: AttendanceRecord[]) => void,
  onError?: (message: string) => void,
) {
  const q = query(
    collection(db, ATTENDANCES_COLLECTION),
    where("workDate", "==", workDate),
  );
  return onSnapshot(
    q,
    (snap) => {
      const list: AttendanceRecord[] = [];
      for (const d of snap.docs) {
        const row = docToAttendance(d.id, d.data() as Record<string, unknown>);
        if (row) list.push(row);
      }
      list.sort((a, b) => a.userName.localeCompare(b.userName, "ko"));
      onNext(list);
    },
    (err) => onError?.(err.message),
  );
}

export function subscribeAllAttendances(
  onNext: (rows: AttendanceRecord[]) => void,
  onError?: (message: string) => void,
) {
  return onSnapshot(
    collection(db, ATTENDANCES_COLLECTION),
    (snap) => {
      const list: AttendanceRecord[] = [];
      for (const d of snap.docs) {
        const row = docToAttendance(d.id, d.data() as Record<string, unknown>);
        if (row) list.push(row);
      }
      list.sort((a, b) => b.workDate.localeCompare(a.workDate) || b.createdAt.localeCompare(a.createdAt));
      onNext(list);
    },
    (err) => onError?.(err.message),
  );
}

export async function listAttendancesByEvent(
  eventId: string,
): Promise<AttendanceRecord[]> {
  const snap = await getDocs(
    query(
      collection(db, ATTENDANCES_COLLECTION),
      where("eventId", "==", eventId),
    ),
  );
  const list: AttendanceRecord[] = [];
  for (const d of snap.docs) {
    const row = docToAttendance(d.id, d.data() as Record<string, unknown>);
    if (row) list.push(row);
  }
  return list;
}

/** Latest non-superseded attendance for an application (prefer pending/approved). */
export function pickLatestAttendance(
  rows: AttendanceRecord[],
  applicationId: string,
): AttendanceRecord | undefined {
  const matched = rows
    .filter((r) => r.applicationId === applicationId)
    .sort((a, b) => b.attempt - a.attempt || b.createdAt.localeCompare(a.createdAt));
  return matched[0];
}

export function canShowCheckInButton(input: {
  app: ApplicationItem;
  event: EventItem | undefined;
  existing: AttendanceRecord | undefined;
  now?: Date;
}): boolean {
  const { app, event, existing, now = new Date() } = input;
  if (app.status !== "approved" && app.status !== "completed") return false;
  const settings = parseAttendanceSettings(event?.attendance);
  if (!settings.attendanceEnabled) return false;
  if (!isWithinCheckInWindow(settings, app.date, app.slotTime, now)) {
    return false;
  }
  if (!existing) return true;
  return existing.reviewStatus === "rejected";
}

async function uploadAttendancePhoto(input: {
  workDate: string;
  eventId: string;
  userId: string;
  attendanceId: string;
  blob: Blob;
}): Promise<{ storagePath: string; photoUrl: string }> {
  const storagePath = `attendance/${input.workDate}/${input.eventId}/${input.userId}/${input.attendanceId}.jpg`;
  const storageRef = ref(storage, storagePath);
  await uploadBytes(storageRef, input.blob, {
    contentType: "image/jpeg",
    cacheControl: "private, max-age=3600",
  });
  const photoUrl = await getDownloadURL(storageRef);
  return { storagePath, photoUrl };
}

export async function submitAttendanceCheckIn(input: {
  app: ApplicationItem;
  event: EventItem;
  userId: string;
  userName: string;
  teamId: TeamId;
  photoFile: File | null;
  previousAttendanceId?: string | null;
  attempt?: number;
  /** watchPosition으로 미리 수집한 좌표. 있으면 getCurrentPosition 재호출 생략 */
  prefetchedPosition?: { latitude: number; longitude: number; accuracy: number };
  /** Mock Location 감지 결과. suspicious일 때만 전달 */
  mockLocationSignal?: MockLocationSignal;
}): Promise<string> {
  const settings = parseAttendanceSettings(input.event.attendance);
  if (!settings.attendanceEnabled) {
    throw new Error("이 일정은 출근 인증을 사용하지 않습니다.");
  }
  if (input.app.status !== "approved" && input.app.status !== "completed") {
    throw new Error("승인된 일정만 출근 인증할 수 있습니다.");
  }
  if (input.app.userId && input.app.userId !== input.userId) {
    throw new Error("본인 일정에만 출근 인증할 수 있습니다.");
  }
  if (!isWithinCheckInWindow(settings, input.app.date, input.app.slotTime)) {
    throw new Error("지금은 출근 인증 가능 시간이 아닙니다.");
  }
  if (settings.photoRequired && !input.photoFile) {
    throw new Error("인증 사진이 필요합니다.");
  }

  let latitude: number | null = null;
  let longitude: number | null = null;
  let accuracy: number | null = null;
  let distanceFromVenueMeters: number | null = null;

  if (
    settings.locationVerificationEnabled &&
    settings.outsideRadiusPolicy !== "ignore_gps"
  ) {
    try {
      let lat: number, lon: number, acc: number;

      if (input.prefetchedPosition) {
        // watchPosition으로 미리 수집한 좌표 재활용
        ({ latitude: lat, longitude: lon, accuracy: acc } = input.prefetchedPosition);
      } else {
        const pos = await getCurrentPosition();
        lat = pos.coords.latitude;
        lon = pos.coords.longitude;
        acc = typeof pos.coords.accuracy === "number" ? pos.coords.accuracy : 999;
      }

      latitude = lat;
      longitude = lon;
      accuracy = acc;

      if (settings.venueLatitude != null && settings.venueLongitude != null) {
        distanceFromVenueMeters = Math.round(
          haversineMeters(latitude, longitude, settings.venueLatitude, settings.venueLongitude),
        );
      }
    } catch {
      if (settings.outsideRadiusPolicy === "block") {
        throw new Error("GPS 위치를 확인할 수 없어 인증할 수 없습니다.");
      }
      latitude = null;
      longitude = null;
      accuracy = null;
      distanceFromVenueMeters = null;
    }
  }

  const locationStatus = computeLocationStatus({
    settings,
    latitude,
    longitude,
    accuracy,
    distanceMeters: distanceFromVenueMeters,
  });

  if (
    settings.outsideRadiusPolicy === "block" &&
    (locationStatus === "outside_radius" ||
      locationStatus === "location_unavailable" ||
      locationStatus === "low_accuracy")
  ) {
    throw new Error("행사장 반경 밖에서 인증할 수 없습니다.");
  }

  const now = new Date();
  const timeStatus = computeTimeStatus(
    settings,
    input.app.date,
    input.app.slotTime,
    now,
  );
  const scheduled = scheduledCheckInDate(input.app.date, input.app.slotTime);
  const attendanceId = crypto.randomUUID();
  const attempt = input.attempt ?? 1;

  let photoUrl: string | null = null;
  let storagePath: string | null = null;
  let photoStatus: AttendanceRecord["photoStatus"] = "none";

  if (input.photoFile) {
    const blob = await compressAttendancePhoto(input.photoFile);
    const uploaded = await uploadAttendancePhoto({
      workDate: input.app.date,
      eventId: input.app.eventId ?? input.event.id,
      userId: input.userId,
      attendanceId,
      blob,
    });
    photoUrl = uploaded.photoUrl;
    storagePath = uploaded.storagePath;
    photoStatus = "active";
  }

  const lockId = `${input.userId}_${input.app.id}`;
  const lockRef = doc(db, "attendance_locks", lockId);
  const attendanceRef = doc(db, ATTENDANCES_COLLECTION, attendanceId);

  await runTransaction(db, async (tx) => {
    const lockSnap = await tx.get(lockRef);
    if (lockSnap.exists()) {
      const lock = lockSnap.data() as {
        reviewStatus?: string;
        attempt?: number;
        currentAttendanceId?: string;
      };
      if (lock.reviewStatus === "pending" || lock.reviewStatus === "approved") {
        throw new Error("이미 출근 인증이 완료되었습니다.");
      }
    }

    const nextAttempt =
      typeof lockSnap.data()?.attempt === "number"
        ? Number(lockSnap.data()?.attempt) + 1
        : attempt;

    tx.set(attendanceRef, {
      userId: input.userId,
      userName: input.userName,
      teamId: input.teamId,
      applicationId: input.app.id,
      eventId: input.app.eventId ?? input.event.id,
      eventName: input.app.eventTitle || input.event.title,
      workDate: input.app.date,
      slotTime: input.app.slotTime,
      venue: input.app.venue || input.event.venue,
      scheduledCheckInAt: scheduled.toISOString(),
      actualCheckInAt: serverTimestamp(),
      clientCheckInAt: now.toISOString(),
      latitude,
      longitude,
      accuracy,
      venueLatitude: settings.venueLatitude,
      venueLongitude: settings.venueLongitude,
      distanceFromVenueMeters,
      timeStatus,
      locationStatus,
      photoUrl,
      storagePath,
      reviewStatus: "pending" satisfies AttendanceReviewStatus,
      reviewedBy: null,
      reviewedAt: null,
      adminMemo: "",
      rejectionReason: null,
      photoDeleteAt: null,
      photoDeletedAt: null,
      photoStatus,
      photoDeletionError: null,
      photoDeletionRetryCount: 0,
      previousAttendanceId:
        input.previousAttendanceId ??
        (typeof lockSnap.data()?.currentAttendanceId === "string"
          ? lockSnap.data()?.currentAttendanceId
          : null),
      attempt: nextAttempt,
      // Mock Location 감지 결과 저장
      mockLocationRiskLevel: input.mockLocationSignal?.riskLevel ?? null,
      mockLocationReasons: input.mockLocationSignal?.reasons ?? null,
      // Cloud Function이 채울 서버사이드 검증 필드 (초기값)
      gpsVerified: false,
      serverDistanceMeters: null,
      gpsSuspicious: false,
      gpsSuspiciousReasons: null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    tx.set(lockRef, {
      userId: input.userId,
      applicationId: input.app.id,
      currentAttendanceId: attendanceId,
      reviewStatus: "pending",
      attempt: nextAttempt,
      updatedAt: serverTimestamp(),
    });
  });

  try {
    await notifyAdminsOnAttendanceSubmitted({
      attendanceId,
      applicationId: input.app.id,
      eventId: input.app.eventId ?? input.event.id,
      eventTitle: input.app.eventTitle || input.event.title,
      eventDate: input.app.date,
      slotTime: input.app.slotTime,
      location: input.app.venue || input.event.venue,
      applicantName: input.userName,
      createdByUserId: input.userId,
    });
  } catch {
    // 알림 실패해도 인증 저장 유지
  }

  return attendanceId;
}

export async function reviewAttendance(input: {
  attendanceId: string;
  adminUid: string;
  decision: "approved" | "rejected";
  adminMemo?: string;
  rejectionReason?: string;
}): Promise<void> {
  const refDoc = doc(db, ATTENDANCES_COLLECTION, input.attendanceId);
  const snap = await getDoc(refDoc);
  if (!snap.exists()) throw new Error("출근 인증 기록을 찾을 수 없습니다.");
  const data = snap.data() as Record<string, unknown>;
  if (data.reviewStatus === "approved") {
    throw new Error("이미 확인 완료된 인증입니다.");
  }

  const applicationId = String(data.applicationId ?? "");
  const userId = String(data.userId ?? "");
  const lockRef = doc(db, "attendance_locks", `${userId}_${applicationId}`);

  // photoDeleteAt 은 Cloud Function onUpdate에서 서버 시각(+24h)으로 설정
  await updateDoc(refDoc, {
    reviewStatus: input.decision,
    reviewedBy: input.adminUid,
    reviewedAt: serverTimestamp(),
    adminMemo: (input.adminMemo ?? "").trim(),
    rejectionReason:
      input.decision === "rejected"
        ? (input.rejectionReason ?? "기타").trim()
        : null,
    photoStatus:
      typeof data.storagePath === "string" && data.storagePath
        ? "scheduled_for_deletion"
        : "none",
    photoDeleteAtHintMs: 24 * 60 * 60 * 1000,
    updatedAt: serverTimestamp(),
  });

  await setDoc(
    lockRef,
    {
      reviewStatus: input.decision,
      currentAttendanceId: input.attendanceId,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );

  try {
    await notifyMemberOnAttendanceReviewed({
      targetUserId: String(data.userId),
      attendanceId: input.attendanceId,
      applicationId: String(data.applicationId ?? ""),
      eventId: String(data.eventId ?? ""),
      eventTitle: String(data.eventName ?? ""),
      eventDate: String(data.workDate ?? ""),
      slotTime: String(data.slotTime ?? ""),
      location: String(data.venue ?? ""),
      decision: input.decision,
      rejectionReason:
        input.decision === "rejected" ? input.rejectionReason ?? null : null,
      createdByUserId: input.adminUid,
    });
  } catch {
    // ignore
  }
}

export async function updateAttendanceAdminMemo(
  attendanceId: string,
  adminMemo: string,
): Promise<void> {
  await updateDoc(doc(db, ATTENDANCES_COLLECTION, attendanceId), {
    adminMemo: adminMemo.trim(),
    updatedAt: serverTimestamp(),
  });
}

export function getAttendanceSettingsForEvent(
  event: EventItem | undefined,
): AttendanceSettings {
  return parseAttendanceSettings(event?.attendance);
}

export { getCheckInWindow };
