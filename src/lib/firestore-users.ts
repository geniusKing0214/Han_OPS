import {
  type FirestoreError,
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";

import { db } from "@/lib/firebase";
import type { UserApprovalStatus, UserProfileDoc, UserRole } from "@/types/user";

export const USERS_COLLECTION = "users";

export async function createMemberProfile(
  uid: string,
  email: string,
  displayName?: string | null,
) {
  const ref = doc(db, USERS_COLLECTION, uid);
  const existing = await getDoc(ref);
  if (existing.exists()) return;

  await setDoc(ref, {
    email,
    role: "member",
    accountStatus: "pending",
    displayName: typeof displayName === "string" ? displayName.trim() : "",
    createdAt: serverTimestamp(),
  });
}

/** Subscribe to a single user profile document. Caller handles missing docs. */
export function subscribeUserProfile(
  uid: string,
  onData: (data: UserProfileDoc | null) => void,
  onError?: (error: FirestoreError) => void,
) {
  const ref = doc(db, USERS_COLLECTION, uid);
  return onSnapshot(
    ref,
    (snap) => {
      if (!snap.exists()) {
        onData(null);
        return;
      }
      onData(snap.data() as UserProfileDoc);
    },
    (error) => onError?.(error),
  );
}

export type ListedUserRow = UserProfileDoc & { uid: string };

export async function listUsersForAdmin(): Promise<ListedUserRow[]> {
  const snap = await getDocs(collection(db, USERS_COLLECTION));
  const rows = snap.docs.map((d) => ({
    uid: d.id,
    ...(d.data() as UserProfileDoc),
  }));
  return rows.sort((a, b) => a.email.localeCompare(b.email, "ko"));
}

export async function setUserRole(uid: string, role: UserRole) {
  const ref = doc(db, USERS_COLLECTION, uid);
  await updateDoc(ref, { role });
}

export async function setUserApprovalStatus(
  uid: string,
  accountStatus: UserApprovalStatus,
) {
  const ref = doc(db, USERS_COLLECTION, uid);
  await updateDoc(ref, { accountStatus });
}

export async function listPendingUsersForAdmin(): Promise<ListedUserRow[]> {
  const snap = await getDocs(
    query(collection(db, USERS_COLLECTION), where("accountStatus", "==", "pending")),
  );
  const rows = snap.docs.map((d) => ({
    uid: d.id,
    ...(d.data() as UserProfileDoc),
  }));
  return rows.sort((a, b) => a.email.localeCompare(b.email, "ko"));
}

/** 본인 프로필 필드만 갱신 (역할·이메일 변경 없음) */
export async function updateOwnProfile(
  uid: string,
  patch: { displayName: string; phone: string },
) {
  const ref = doc(db, USERS_COLLECTION, uid);
  await updateDoc(ref, {
    displayName: patch.displayName.trim(),
    phone: patch.phone.trim(),
  });
}
