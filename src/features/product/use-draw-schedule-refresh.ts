"use client";

import { useEffect, useRef } from "react";

import { DAILY_DRAW_SLOTS } from "@/lib/gaming/daily-draw-schedule";
import { drawDateKey } from "@/lib/gaming/draw-calendar";
import type { DrawDefinition } from "@/lib/gaming/types";

const MIN_REFRESH_INTERVAL_MS = 60_000;
const DAILY_DRAW_IDS = new Set<string>(DAILY_DRAW_SLOTS.map((slot) => slot.id));

interface DrawScheduleRefreshOptions {
  enabled: boolean;
  now: number | null;
  draws: readonly DrawDefinition[] | undefined;
  loading: boolean;
  refresh: (() => Promise<void>) | undefined;
}

/** Refresh operational dates without inventing tomorrow's backoffice schedule. */
export function useDrawScheduleRefresh({
  enabled,
  now,
  draws,
  loading,
  refresh,
}: DrawScheduleRefreshOptions) {
  const observedDate = useRef<string | null>(null);
  const lastAttempt = useRef<number | null>(null);
  const pendingRefresh = useRef(false);
  const inFlight = useRef(false);

  useEffect(() => {
    if (!enabled) {
      observedDate.current = null;
      pendingRefresh.current = false;
      return;
    }
    if (
      now === null || !Number.isFinite(now) || !Number.isFinite(new Date(now).getTime()) ||
      loading || typeof refresh !== "function"
    ) return;

    const latestDrawAt = draws?.reduce<number | null>((latest, draw) => {
      if (draw.family !== "QUINIELA" || !DAILY_DRAW_IDS.has(draw.id)) return latest;
      const at = Date.parse(draw.drawsAt);
      if (!Number.isFinite(at)) return latest;
      return latest === null || at > latest ? at : latest;
    }, null) ?? null;

    const check = (at: number, fromEvent = false) => {
      if (!Number.isFinite(at) || !Number.isFinite(new Date(at).getTime())) return;
      const dateKey = drawDateKey(at);
      const dateChanged = observedDate.current !== null && observedDate.current !== dateKey;
      observedDate.current = dateKey;
      if (dateChanged || fromEvent) pendingRefresh.current = true;

      const scheduleExpired = latestDrawAt !== null && latestDrawAt <= at;
      if (
        document.visibilityState !== "visible" || inFlight.current ||
        (!pendingRefresh.current && !scheduleExpired) ||
        (lastAttempt.current !== null && at - lastAttempt.current < MIN_REFRESH_INTERVAL_MS)
      ) return;

      lastAttempt.current = at;
      pendingRefresh.current = false;
      inFlight.current = true;
      void (async () => {
        try {
          await refresh();
        } catch {
          // The provider owns visible gateway errors; a background retry must not reject globally.
        } finally {
          inFlight.current = false;
        }
      })();
    };

    check(now);
    const onFocus = () => check(Date.now(), true);
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") check(Date.now(), true);
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [draws, enabled, loading, now, refresh]);
}
