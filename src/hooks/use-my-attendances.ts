"use client";

import { useEffect, useState } from "react";

import { useAuth } from "@/components/providers/auth-provider";
import { subscribeMyAttendances } from "@/lib/firestore-attendance";
import type { AttendanceRecord } from "@/types/attendance";

export function useMyAttendances() {
  const { user } = useAuth();
  const [items, setItems] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user?.uid) {
      setItems([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    return subscribeMyAttendances(
      user.uid,
      (rows) => {
        setItems(rows);
        setLoading(false);
        setError("");
      },
      (message) => {
        setError(message);
        setLoading(false);
      },
    );
  }, [user?.uid]);

  return { items, loading, error };
}
