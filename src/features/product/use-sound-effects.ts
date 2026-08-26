"use client";

import { useCallback, useEffect, useRef } from "react";

const SOUND_FILES = {
  confirm: "/assets/sounds/play_confirm.wav",
  reelStart: "/assets/sounds/reel_start.wav",
  reelTick: "/assets/sounds/reel_tick.wav",
  reelStop: "/assets/sounds/reel_stop.wav",
  win: "/assets/sounds/win_small.wav",
  lose: "/assets/sounds/lose.wav",
  ticket: "/assets/sounds/ticket_open.wav",
} as const;

type SoundName = keyof typeof SOUND_FILES;
type SoundChannel = SoundName | "reel";

const SOUND_CHANNELS: Partial<Record<SoundName, SoundChannel>> = {
  reelStart: "reel",
  reelTick: "reel",
  reelStop: "reel",
};

const SOUND_VOLUMES: Record<SoundName, number> = {
  confirm: 0.34,
  reelStart: 0.24,
  reelTick: 0.16,
  reelStop: 0.25,
  win: 0.34,
  lose: 0.3,
  ticket: 0.3,
};

export type SoundPlayer = (name: SoundName, action?: "play" | "stop") => void;

function soundEnabled() {
  try {
    return window.localStorage.getItem("quinie_sound") === "on";
  } catch {
    return false;
  }
}

export function useSoundEffects() {
  const audioCache = useRef(new Map<SoundName, HTMLAudioElement>());
  const activeChannels = useRef(new Map<SoundChannel, HTMLAudioElement>());
  const channelGenerations = useRef(new Map<SoundChannel, number>());

  const stop = useCallback((name?: SoundName) => {
    const channels = activeChannels.current;
    const targetChannel = name ? (SOUND_CHANNELS[name] ?? name) : undefined;

    for (const [channel, audio] of channels) {
      if (targetChannel && channel !== targetChannel) continue;
      audio.pause();
      try {
        audio.currentTime = 0;
      } catch {
        // Some media implementations do not expose a seekable timeline yet.
      }
      channelGenerations.current.set(
        channel,
        (channelGenerations.current.get(channel) ?? 0) + 1,
      );
      channels.delete(channel);
    }
  }, []);

  const playSound = useCallback(
    (name: SoundName, action: "play" | "stop" = "play") => {
      if (action === "stop") {
        stop(name);
        return;
      }

      if (!soundEnabled()) {
        stop(name);
        return;
      }

      try {
        const channel = SOUND_CHANNELS[name] ?? name;
        const active = activeChannels.current.get(channel);
        const cached = audioCache.current.get(name);
        const audio = cached ?? new Audio(SOUND_FILES[name]);

        if (!cached) {
          audio.preload = "auto";
          audioCache.current.set(name, audio);
        }

        // All mechanical reel sounds share one channel. A result containing five
        // or ten reels therefore never stacks multiple ticks/stops on top of each other.
        if (active) {
          active.pause();
          try {
            active.currentTime = 0;
          } catch {
            // Seeking can fail before media metadata is available.
          }
        }

        audio.volume = SOUND_VOLUMES[name];
        try {
          audio.currentTime = 0;
        } catch {
          // Start from the browser-selected position when seeking is unavailable.
        }
        activeChannels.current.set(channel, audio);
        const generation = (channelGenerations.current.get(channel) ?? 0) + 1;
        channelGenerations.current.set(channel, generation);
        audio.onended = () => {
          if (
            activeChannels.current.get(channel) === audio &&
            channelGenerations.current.get(channel) === generation
          ) {
            activeChannels.current.delete(channel);
          }
        };

        // Effect-driven audio can be rejected until the first user gesture. Later
        // ticks retry naturally; the rejected promise is always handled and never
        // blocks the play flow.
        void audio.play().catch(() => {
          if (
            activeChannels.current.get(channel) === audio &&
            channelGenerations.current.get(channel) === generation
          ) {
            activeChannels.current.delete(channel);
          }
        });
      } catch {
        // Sound is progressive enhancement; unavailable media APIs must not block play.
      }
    },
    [stop],
  );

  useEffect(() => {
    const cache = audioCache.current;
    const stopWhenDisabled = () => {
      if (!soundEnabled()) stop();
    };

    window.addEventListener("storage", stopWhenDisabled);
    window.addEventListener("quinie:preferences-changed", stopWhenDisabled);
    return () => {
      window.removeEventListener("storage", stopWhenDisabled);
      window.removeEventListener("quinie:preferences-changed", stopWhenDisabled);
      stop();
      cache.clear();
    };
  }, [stop]);

  return playSound;
}
