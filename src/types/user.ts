export type UserRole = "admin" | "member";

/** Firestore `users/{uid}` document shape used by this app */
export type UserProfileDoc = {
  email: string;
  role: UserRole;
  /** Firestore Timestamp at runtime */
  createdAt?: unknown;
  /** 사용자 지정 표시 이름 */
  displayName?: string;
  /** 연락처(전화 등) */
  phone?: string;
};
