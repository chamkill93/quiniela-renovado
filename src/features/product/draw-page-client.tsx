"use client";

import { useMemo } from "react";

import { isDrawDateKey } from "@/lib/gaming/draw-calendar";
import { buildPreviewDailyDraws, buildPreviewDrawsForDate } from "@/lib/gaming/daily-draw-schedule";
import { useProduct } from "@/providers/product-provider";

import {
  selectDrawPageSchedule,
  type DrawPageDefinition,
} from "./draw-page-data";
import styles from "./draw-page.module.css";
import { DrawStreamContent } from "./draw-stream-content";
import { useDrawClock } from "./use-draw-clock";

interface DrawPageClientProps {
  definition: DrawPageDefinition;
  streamUrl: string | null;
  selectedDate?: string | null;
}

export function DrawPageClient({
  definition,
  streamUrl,
  selectedDate,
}: DrawPageClientProps) {
  const { catalog, gatewayMode } = useProduct();
  const { now, openedAt } = useDrawClock();
  const isSimulated = gatewayMode === "preview";
  const dateKey = selectedDate && isDrawDateKey(selectedDate) ? selectedDate : null;
  const schedule = useMemo(
    () => {
      if (isSimulated) {
        if (openedAt === null) return null;
        const previewDraws = dateKey
          ? buildPreviewDrawsForDate(dateKey)
          : buildPreviewDailyDraws(openedAt);
        return selectDrawPageSchedule(previewDraws, definition, dateKey, openedAt);
      }
      return catalog
        ? selectDrawPageSchedule(catalog.draws, definition, dateKey, openedAt)
        : null;
    },
    [catalog, dateKey, definition, isSimulated, openedAt],
  );

  return (
    <main className={styles.page} data-draw-id={definition.drawId} data-testid="draw-page">
      <h1 className={styles.title} data-testid="draw-page-title">{definition.name}</h1>

      <DrawStreamContent
        drawName={definition.name}
        drawsAt={schedule?.drawsAt ?? null}
        isSimulated={isSimulated}
        now={now}
        streamUrl={streamUrl}
      />
    </main>
  );
}
