"use client";

import { useEffect, useState } from "react";

import { subscribeEvents } from "@/lib/firestore-events";
import type { EventItem } from "@/types/schedule";

export function useEvents() {
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    const unsub = subscribeEvents(
      (list) => {
        setEvents(list);
        setLoading(false);
      },
      (msg) => {
        setError(msg);
        setLoading(false);
      },
    );
    return unsub;
  }, []);

  return { events, loading, error };
}
