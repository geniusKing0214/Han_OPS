"use client";

import { useEffect, useState } from "react";

import { useAuth } from "@/components/providers/auth-provider";
import { subscribeMyApplications } from "@/lib/firestore-applications";
import type { ApplicationItem } from "@/types/application";

export function useMyApplications() {
  const { user } = useAuth();
  const [items, setItems] = useState<ApplicationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user) {
      setItems([]);
      setLoading(false);
      setError("");
      return;
    }

    setLoading(true);
    setError("");
    const unsub = subscribeMyApplications(
      user.uid,
      (list) => {
        setItems(list);
        setLoading(false);
      },
      (err) => {
        setError(err.message || "신청 목록을 불러오지 못했습니다.");
        setLoading(false);
      },
    );
    return () => unsub();
  }, [user]);

  return { items, loading, error };
}
