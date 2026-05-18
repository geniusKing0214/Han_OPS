import { doc, getDoc } from "firebase/firestore";

import { auth, db } from "@/lib/firebase";

/**
 * 클라이언트에서 관리자 전용 Firestore 작업 전 호출합니다.
 * Firestore rules(`isAdmin()`)와 함께 이중으로 적용됩니다.
 */
export async function assertAdmin(): Promise<string> {
  const uid = auth.currentUser?.uid;
  if (!uid) {
    throw new Error("로그인이 필요합니다.");
  }
  const snap = await getDoc(doc(db, "users", uid));
  const role = snap.exists()
    ? (snap.data() as { role?: string }).role
    : undefined;
  if (role !== "admin") {
    throw new Error("관리자 권한이 필요합니다.");
  }
  return uid;
}
