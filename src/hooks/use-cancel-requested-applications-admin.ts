"use client";

import { useEffect, useState } from "react";

import { subscribeCancelRequestedApplicationsForAdmin } from "@/lib/firestore-applications";
import type { ApplicationItem } from "@/types/application";

export function useCancelRequestedApplicationsAdmin() {
  const [cancelRequested, setCancelRequested] = useState<ApplicationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    setLoading(true);
    setError("");
    const unsub = subscribeCancelRequestedApplicationsForAdmin(
      (list) => {
        setCancelRequested(list);
        setLoading(false);
      },
      (err) => {
        setError(err.message || "취소 요청을 불러오지 못했습니다.");
        setLoading(false);
      },
    );
    return () => unsub();
  }, []);

  return { cancelRequested, loading, error };
}
