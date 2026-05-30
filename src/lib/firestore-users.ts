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
import { DEFAULT_TEAM_ID, normalizeTeamId } from "@/types/team";
import type { UserApprovalStatus, UserProfileDoc, UserRole } from "@/types/user";
import type { TeamId } from "@/types/team";

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
    team_id: DEFAULT_TEAM_ID,
    displayName: typeof displayName === "string" ? displayName.trim() : "",
    total_points: 0,
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
  teamId?: TeamId,
) {
  const ref = doc(db, USERS_COLLECTION, uid);
  const patch: Record<string, unknown> = { accountStatus };
  if (accountStatus === "approved") {
    patch.team_id = normalizeTeamId(teamId);
  }
  await updateDoc(ref, patch);
}

export async function setUserTeamId(uid: string, teamId: TeamId) {
  const ref = doc(db, USERS_COLLECTION, uid);
  await updateDoc(ref, { team_id: normalizeTeamId(teamId) });
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

/** 관리자 화면용: 여러 uid의 프로필(이메일·닉네임)을 한 번에 조회 */
export async function getUserProfilesByIds(
  uids: string[],
): Promise<
  Map<string, { email: string; displayName: string; totalPoints: number }>
> {
  const unique = [...new Set(uids.map((u) => u.trim()).filter(Boolean))];
  const map = new Map<
    string,
    { email: string; displayName: string; totalPoints: number }
  >();
  await Promise.all(
    unique.map(async (uid) => {
      const snap = await getDoc(doc(db, USERS_COLLECTION, uid));
      if (!snap.exists()) return;
      const data = snap.data() as UserProfileDoc;
      map.set(uid, {
        email: typeof data.email === "string" ? data.email : "",
        displayName:
          typeof data.displayName === "string" ? data.displayName.trim() : "",
        totalPoints:
          typeof data.total_points === "number" ? data.total_points : 0,
      });
    }),
  );
  return map;
}

/** 관리자: 전체 사용자 목록 실시간 구독 (랭킹용) */
export function subscribeAllUsersForAdmin(
  onData: (rows: ListedUserRow[]) => void,
  onError?: (error: FirestoreError) => void,
) {
  return onSnapshot(
    collection(db, USERS_COLLECTION),
    (snap) => {
      const rows = snap.docs
        .map((d) => ({
          uid: d.id,
          ...(d.data() as UserProfileDoc),
        }))
        .filter((r) => r.role !== "admin");
      onData(rows);
    },
    (err) => onError?.(err),
  );
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
