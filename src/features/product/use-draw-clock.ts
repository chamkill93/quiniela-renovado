"use client";

import { useEffect, useState } from "react";

interface DrawClock {
  now: number | null;
  openedAt: number | null;
}

/** A live clock with a stable entry time, so an open draw never rolls to tomorrow. */
export function useDrawClock(): DrawClock {
  const [clock, setClock] = useState<DrawClock>({ now: null, openedAt: null });

  useEffect(() => {
    const update = () => {
      const now = Date.now();
      setClock((current) => ({ now, openedAt: current.openedAt ?? now }));
    };
    const initial = window.setTimeout(update, 0);
    const interval = window.setInterval(update, 1_000);
    window.addEventListener("focus", update);
    document.addEventListener("visibilitychange", update);

    return () => {
      window.clearTimeout(initial);
      window.clearInterval(interval);
      window.removeEventListener("focus", update);
      document.removeEventListener("visibilitychange", update);
    };
  }, []);

  return clock;
}
