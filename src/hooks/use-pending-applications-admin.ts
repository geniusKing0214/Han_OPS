"use client";

import { useEffect, useState } from "react";

import { subscribePendingApplicationsForAdmin } from "@/lib/firestore-applications";
import type { ApplicationItem } from "@/types/application";

export function usePendingApplicationsAdmin() {
  const [pending, setPending] = useState<ApplicationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    setLoading(true);
    setError("");
    const unsub = subscribePendingApplicationsForAdmin(
      (list) => {
        setPending(list);
        setLoading(false);
      },
      (err) => {
        setError(err.message || "대기 신청을 불러오지 못했습니다.");
        setLoading(false);
      },
    );
    return () => unsub();
  }, []);

  return { pending, loading, error };
}
