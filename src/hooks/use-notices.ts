"use client";

import { useEffect, useState } from "react";

import { subscribeNotices } from "@/lib/firestore-notices";
import type { NoticeDoc } from "@/types/notice";

export function useNotices() {
  const [rows, setRows] = useState<NoticeDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    const unsub = subscribeNotices(
      (list) => {
        setRows(list);
        setLoading(false);
        setError(null);
      },
      (msg) => {
        setError(msg);
        setLoading(false);
      },
    );
    return unsub;
  }, []);

  return { rows, loading, error };
}
