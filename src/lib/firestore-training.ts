import {
  type FirestoreError,
  addDoc,
  collection,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";

import { db } from "@/lib/firebase";
import type {
  TrainingApplicant,
  TrainingItem,
  TrainingStatus,
} from "@/types/training";

export const TRAININGS_COLLECTION = "trainings";

function timestampToIso(value: unknown): string {
  if (
    value &&
    typeof value === "object" &&
    "toDate" in value &&
    typeof (value as { toDate: () => Date }).toDate === "function"
  ) {
    return (value as { toDate: () => Date }).toDate().toISOString();
  }
  if (typeof value === "string") return value;
  return new Date().toISOString();
}

function docToTraining(id: string, data: Record<string, unknown>): TrainingItem {
  const applicants = Array.isArray(data.applicants)
    ? (data.applicants as Array<Record<string, unknown>>)
        .filter((a) => typeof a.uid === "string")
        .map((a) => ({
          uid: a.uid as string,
          name: typeof a.name === "string" ? a.name : "",
          appliedAt:
            typeof a.appliedAt === "string" ? a.appliedAt : timestampToIso(a.appliedAt),
        }))
    : [];
  return {
    id,
    title: typeof data.title === "string" ? data.title : "",
    location: typeof data.location === "string" ? data.location : "",
    startAt: typeof data.startAt === "string" ? data.startAt : "",
    content: typeof data.content === "string" ? data.content : "",
    capacity: typeof data.capacity === "number" ? data.capacity : 0,
    applicants,
    status: data.status === "closed" ? "closed" : "open",
    closeReason:
      data.closeReason === "capacity" || data.closeReason === "manual"
        ? data.closeReason
        : undefined,
    createdBy: typeof data.createdBy === "string" ? data.createdBy : "",
    createdByName:
      typeof data.createdByName === "string" ? data.createdByName : "",
    createdAt: timestampToIso(data.createdAt),
    updatedAt: timestampToIso(data.updatedAt),
  };
}

export function subscribeTrainings(
  onData: (rows: TrainingItem[]) => void,
  onError?: (e: FirestoreError) => void,
) {
  const q = query(collection(db, TRAININGS_COLLECTION), orderBy("startAt", "asc"));
  return onSnapshot(
    q,
    (snap) => {
      onData(snap.docs.map((d) => docToTraining(d.id, d.data() as Record<string, unknown>)));
    },
    (err) => onError?.(err),
  );
}

export async function createTraining(input: {
  title: string;
  location: string;
  startAt: string;
  content: string;
  capacity: number;
  createdBy: string;
  createdByName: string;
}): Promise<string> {
  const ref = await addDoc(collection(db, TRAININGS_COLLECTION), {
    title: input.title.trim(),
    location: input.location.trim(),
    startAt: input.startAt,
    content: input.content.trim(),
    capacity: Math.max(1, Math.floor(input.capacity)),
    applicants: [],
    status: "open" as TrainingStatus,
    createdBy: input.createdBy,
    createdByName: input.createdByName,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function applyToTraining(
  trainingId: string,
  uid: string,
  name: string,
): Promise<void> {
  const ref = doc(db, TRAININGS_COLLECTION, trainingId);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error("교육을 찾을 수 없습니다.");
    const data = snap.data();
    const applicants = (data.applicants ?? []) as TrainingApplicant[];
    if (data.status !== "open") {
      throw new Error("마감된 교육입니다.");
    }
    if (applicants.some((a) => a.uid === uid)) {
      throw new Error("이미 신청한 교육입니다.");
    }
    const capacity = typeof data.capacity === "number" ? data.capacity : 0;
    if (applicants.length >= capacity) {
      throw new Error("정원이 마감되었습니다.");
    }
    const nextApplicants = [
      ...applicants,
      { uid, name, appliedAt: new Date().toISOString() },
    ];
    const patch: Record<string, unknown> = {
      applicants: nextApplicants,
      updatedAt: serverTimestamp(),
    };
    if (nextApplicants.length >= capacity) {
      patch.status = "closed";
      patch.closeReason = "capacity";
    }
    tx.update(ref, patch);
  });
}

export async function cancelTrainingApplication(
  trainingId: string,
  uid: string,
): Promise<void> {
  const ref = doc(db, TRAININGS_COLLECTION, trainingId);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error("교육을 찾을 수 없습니다.");
    const data = snap.data();
    const applicants = (data.applicants ?? []) as TrainingApplicant[];
    const nextApplicants = applicants.filter((a) => a.uid !== uid);
    if (nextApplicants.length === applicants.length) {
      throw new Error("신청 내역이 없습니다.");
    }
    const capacity = typeof data.capacity === "number" ? data.capacity : 0;
    const patch: Record<string, unknown> = {
      applicants: nextApplicants,
      updatedAt: serverTimestamp(),
    };
    // 정원 마감으로 닫혔던 경우, 취소로 자리가 나면 다시 모집중으로 전환한다.
    // 생성자/관리자가 직접 마감한 경우(closeReason='manual')는 그대로 유지한다.
    if (data.status === "closed" && data.closeReason === "capacity" && nextApplicants.length < capacity) {
      patch.status = "open";
      patch.closeReason = null;
    }
    tx.update(ref, patch);
  });
}

/** 생성자 또는 관리자가 직접 마감 처리 */
export async function closeTraining(
  trainingId: string,
  actorUid: string,
  isAdmin: boolean,
): Promise<void> {
  const ref = doc(db, TRAININGS_COLLECTION, trainingId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error("교육을 찾을 수 없습니다.");
  const data = snap.data();
  if (data.createdBy !== actorUid && !isAdmin) {
    throw new Error("마감 권한이 없습니다.");
  }
  await updateDoc(ref, {
    status: "closed",
    closeReason: "manual",
    updatedAt: serverTimestamp(),
  });
}

/** 생성자 또는 관리자가 다시 모집중으로 전환 */
export async function reopenTraining(
  trainingId: string,
  actorUid: string,
  isAdmin: boolean,
): Promise<void> {
  const ref = doc(db, TRAININGS_COLLECTION, trainingId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error("교육을 찾을 수 없습니다.");
  const data = snap.data();
  if (data.createdBy !== actorUid && !isAdmin) {
    throw new Error("권한이 없습니다.");
  }
  await updateDoc(ref, {
    status: "open",
    closeReason: null,
    updatedAt: serverTimestamp(),
  });
}
