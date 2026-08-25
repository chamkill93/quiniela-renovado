"use client";

import { useCallback } from "react";

const SOUND_FILES = {
  confirm: "/assets/sounds/play_confirm.wav",
  reelStart: "/assets/sounds/reel_start.wav",
  reelTick: "/assets/sounds/reel_tick.wav",
  reelStop: "/assets/sounds/reel_stop.wav",
  win: "/assets/sounds/win_small.wav",
  lose: "/assets/sounds/lose.wav",
  ticket: "/assets/sounds/ticket_open.wav",
} as const;

export function useSoundEffects() {
  return useCallback((name: keyof typeof SOUND_FILES) => {
    try {
      if (window.localStorage.getItem("quinie_sound") !== "on") return;
      const audio = new Audio(SOUND_FILES[name]);
      audio.volume = name === "reelTick" ? 0.22 : 0.42;
      void audio.play().catch(() => undefined);
    } catch {
      // Sound is an enhancement; browser media restrictions must never block a play.
    }
  }, []);
}
