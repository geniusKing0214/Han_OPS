"use client";

import { User, onAuthStateChanged, signOut } from "firebase/auth";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { firebaseConfigError, isFirebaseConfigured } from "@/lib/firebase";
import { getClientAuth, getClientAuthReady } from "@/lib/firebase-auth";
import { signInWithGoogleForBrowser } from "@/lib/google-sign-in";
import {
  createMemberProfile,
  subscribeUserProfile,
} from "@/lib/firestore-users";
import type { UserApprovalStatus, UserRole } from "@/types/user";
import { normalizeTeamId, type TeamId } from "@/types/team";

export type AuthProfile = {
  email: string;
  role: UserRole;
  accountStatus: UserApprovalStatus;
  teamId: TeamId;
  displayName?: string;
  phone?: string;
};

type AuthContextValue = {
  user: User | null;
  profile: AuthProfile | null;
  /** Auth persistence 복원·프로필 로드 중 */
  loading: boolean;
  /** Firebase Auth 초기화 완료 (복원 전 로그아웃 처리 방지) */
  authReady: boolean;
  isAdmin: boolean;
  canAccessApp: boolean;
  signInWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function normalizeRole(role: unknown): UserRole {
  return role === "admin" ? "admin" : "member";
}

function normalizeAccountStatus(status: unknown): UserApprovalStatus {
  if (status === "pending" || status === "approved" || status === "rejected") {
    return status;
  }
  return "approved";
}

function subscribeProfileForUser(
  nextUser: User,
  onReady: (profile: AuthProfile | null) => void,
  onError: (message?: string) => void,
): () => void {
  let creating = false;

  return subscribeUserProfile(
    nextUser.uid,
    async (data) => {
      if (!data) {
        if (creating) return;
        creating = true;
        try {
          await createMemberProfile(
            nextUser.uid,
            nextUser.email ?? "",
            nextUser.displayName,
          );
        } catch (err) {
          creating = false;
          onError(
            err instanceof Error
              ? err.message
              : "프로필 등록에 실패했습니다. 잠시 후 다시 로그인해 주세요.",
          );
        }
        return;
      }

      creating = false;
      onReady({
        email:
          typeof data.email === "string" ? data.email : nextUser.email ?? "",
        role: normalizeRole(data.role),
        accountStatus: normalizeAccountStatus(data.accountStatus),
        teamId: normalizeTeamId(data.team_id),
        displayName:
          typeof data.displayName === "string" ? data.displayName : undefined,
        phone: typeof data.phone === "string" ? data.phone : undefined,
      });
    },
    (err) => onError(err.message),
  );
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<AuthProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    if (!isFirebaseConfigured) {
      setUser(null);
      setProfile(null);
      setAuthReady(true);
      setLoading(false);
      return;
    }

    let unsubProfile: (() => void) | undefined;
    let unsubAuth: (() => void) | undefined;
    let cancelled = false;

    const bindUser = (nextUser: User | null) => {
      unsubProfile?.();
      unsubProfile = undefined;
      setProfile(null);

      if (!nextUser) {
        setUser(null);
        setLoading(false);
        return;
      }

      setUser(nextUser);
      setLoading(true);

      unsubProfile = subscribeProfileForUser(
        nextUser,
        (nextProfile) => {
          setProfile(nextProfile);
          setLoading(false);
        },
        () => setLoading(false),
      );
    };

    void (async () => {
      try {
        const auth = await getClientAuthReady();
        if (cancelled) return;

        setAuthReady(true);
        bindUser(auth.currentUser);

        unsubAuth = onAuthStateChanged(auth, (nextUser) => {
          bindUser(nextUser);
        });
      } catch {
        if (cancelled) return;
        setAuthReady(true);
        setUser(null);
        setProfile(null);
        setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      unsubProfile?.();
      unsubAuth?.();
    };
  }, []);

  const signInWithGoogle = useCallback(async () => {
    if (!isFirebaseConfigured) {
      throw new Error(firebaseConfigError);
    }
    const auth = getClientAuth();
    await signInWithGoogleForBrowser(auth);
  }, []);

  const logout = useCallback(async () => {
    if (!isFirebaseConfigured) {
      throw new Error(firebaseConfigError);
    }
    await signOut(getClientAuth());
  }, []);

  const isAdmin = profile?.role === "admin";
  const canAccessApp = !!profile && (isAdmin || profile.accountStatus === "approved");

  const value = useMemo(
    () => ({
      user,
      profile,
      loading,
      authReady,
      isAdmin,
      canAccessApp,
      signInWithGoogle,
      logout,
    }),
    [user, profile, loading, authReady, isAdmin, canAccessApp, signInWithGoogle, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used inside AuthProvider");
  }
  return ctx;
}
