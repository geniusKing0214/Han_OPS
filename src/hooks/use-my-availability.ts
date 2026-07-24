"use client";

import { useEffect, useState } from "react";

import { useAuth } from "@/components/providers/auth-provider";
import { subscribeMyAvailability } from "@/lib/firestore-workforce";
import type { WorkforceAvailability } from "@/types/workforce";

export function useMyAvailability() {
  const { user } = useAuth();
  const [avail, setAvail] = useState<WorkforceAvailability | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user) {
      setAvail(null);
      setLoading(false);
      setError("");
      return;
    }

    setLoading(true);
    setError("");
    const unsub = subscribeMyAvailability(
      user.uid,
      (row) => {
        setAvail(row);
        setLoading(false);
      },
      (err) => {
        setError(err.message || "근무 가능일을 불러오지 못했습니다.");
        setLoading(false);
      },
    );
    return () => unsub();
  }, [user]);

  return { avail, loading, error };
}
