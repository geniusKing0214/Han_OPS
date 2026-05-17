"use client";

import { useEffect, useMemo, useState } from "react";

import { useAuth } from "@/components/providers/auth-provider";
import { subscribeMyNotifications } from "@/lib/firestore-notifications";
import type { NotificationItem } from "@/types/notification";

export function useNotifications() {
  const { user } = useAuth();
  const [items, setItems] = useState<NotificationItem[]>([]);
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
    const unsub = subscribeMyNotifications(
      user.uid,
      (list) => {
        setItems(list);
        setLoading(false);
      },
      (err) => {
        setError(err.message || "알림을 불러오지 못했습니다.");
        setLoading(false);
      },
    );
    return () => unsub();
  }, [user]);

  const unreadCount = useMemo(
    () => items.filter((n) => !n.isRead).length,
    [items],
  );

  return { items, loading, error, unreadCount };
}
