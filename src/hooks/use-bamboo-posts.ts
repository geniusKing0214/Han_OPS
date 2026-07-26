"use client";

import { useEffect, useState } from "react";

import { subscribeBambooPosts } from "@/lib/firestore-bamboo";
import type { BambooPost } from "@/types/bamboo";

export function useBambooPosts() {
  const [rows, setRows] = useState<BambooPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    const unsub = subscribeBambooPosts(
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
