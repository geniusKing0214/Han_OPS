"use client";

import {
  User,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
} from "firebase/auth";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { auth, firebaseConfigError, isFirebaseConfigured } from "@/lib/firebase";
import { googleAuthProvider } from "@/lib/google-auth";
import {
  createMemberProfile,
  subscribeUserProfile,
} from "@/lib/firestore-users";
import type { UserRole } from "@/types/user";

export type AuthProfile = {
  email: string;
  role: UserRole;
  displayName?: string;
  phone?: string;
};

type AuthContextValue = {
  user: User | null;
  profile: AuthProfile | null;
  loading: boolean;
  isAdmin: boolean;
  /** Google OAuth 로그인 (신규는 첫 로그인 시 자동 가입) */
  signInWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function normalizeRole(role: unknown): UserRole {
  return role === "admin" ? "admin" : "member";
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<AuthProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isFirebaseConfigured || !auth) {
      setUser(null);
      setProfile(null);
      setLoading(false);
      return;
    }

    let unsubProfile: (() => void) | undefined;

    const unsubAuth = onAuthStateChanged(auth, (nextUser) => {
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

      unsubProfile = subscribeUserProfile(
        nextUser.uid,
        async (data) => {
          if (!data) {
            try {
              await createMemberProfile(
                nextUser.uid,
                nextUser.email ?? "",
              );
            } catch {
              setLoading(false);
            }
            return;
          }

          setProfile({
            email:
              typeof data.email === "string"
                ? data.email
                : nextUser.email ?? "",
            role: normalizeRole(data.role),
            displayName:
              typeof data.displayName === "string"
                ? data.displayName
                : undefined,
            phone: typeof data.phone === "string" ? data.phone : undefined,
          });
          setLoading(false);
        },
        () => setLoading(false),
      );
    });

    return () => {
      unsubProfile?.();
      unsubAuth();
    };
  }, []);

  const signInWithGoogle = useCallback(async () => {
    if (!isFirebaseConfigured || !auth) {
      throw new Error(firebaseConfigError);
    }
    await signInWithPopup(auth, googleAuthProvider);
  }, []);

  const logout = useCallback(async () => {
    if (!isFirebaseConfigured || !auth) {
      throw new Error(firebaseConfigError);
    }
    await signOut(auth);
  }, []);

  const isAdmin = profile?.role === "admin";

  const value = useMemo(
    () => ({
      user,
      profile,
      loading,
      isAdmin,
      signInWithGoogle,
      logout,
    }),
    [user, profile, loading, isAdmin, signInWithGoogle, logout],
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
