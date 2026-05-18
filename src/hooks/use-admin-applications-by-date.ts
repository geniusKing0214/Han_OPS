"use client";

import { useEffect, useState } from "react";

import { subscribeApplicationsByDateForAdmin } from "@/lib/firestore-applications";
import type { ApplicationItem } from "@/types/application";

export function useAdminApplicationsByDate(date: string) {
  const [items, setItems] = useState<ApplicationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!date) {
      setItems([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    const unsub = subscribeApplicationsByDateForAdmin(
      date,
      (list) => {
        setItems(list);
        setLoading(false);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      },
    );
    return unsub;
  }, [date]);

  return { items, loading, error };
}
