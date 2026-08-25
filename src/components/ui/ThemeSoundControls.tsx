"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { Icon } from "./Icon";

export type ThemePreference = "dark" | "light";
export type UiSoundName =
  | "nav"
  | "select"
  | "theme"
  | "play_confirm"
  | "reel_start"
  | "reel_tick"
  | "reel_stop"
  | "ticket_open"
  | "win_small"
  | "win_big"
  | "lose"
  | "notification";

const THEME_STORAGE_KEY = "quinie_theme";
const SOUND_STORAGE_KEY = "quinie_sound";
const PREFERENCES_EVENT = "quinie:preferences-changed";

interface PreferencesContextValue {
  theme: ThemePreference;
  soundEnabled: boolean;
  ready: boolean;
  setTheme: (theme: ThemePreference) => void;
  toggleTheme: () => void;
  setSoundEnabled: (enabled: boolean) => void;
  toggleSound: () => void;
  playSound: (name?: UiSoundName) => void;
}

const PreferencesContext = createContext<PreferencesContextValue | null>(null);

function applyTheme(theme: ThemePreference) {
  document.documentElement.dataset.theme = theme;
}

function applySound(enabled: boolean) {
  document.documentElement.dataset.sound = enabled ? "on" : "off";
}

function playAudio(name: UiSoundName) {
  if (typeof window === "undefined") return;
  const audio = new Audio(`/assets/sounds/${name}.wav`);
  audio.volume = name.startsWith("win_") ? 0.28 : 0.2;
  void audio.play().catch(() => {
    // Browsers may still block playback if the caller was not triggered by a gesture.
  });
}

function readPreferencesSnapshot() {
  if (typeof window === "undefined") return "dark|off";
  try {
    const theme = window.localStorage.getItem(THEME_STORAGE_KEY) === "light" ? "light" : "dark";
    const sound = window.localStorage.getItem(SOUND_STORAGE_KEY) === "on" ? "on" : "off";
    return `${theme}|${sound}`;
  } catch {
    return "dark|off";
  }
}

function subscribeToPreferences(listener: () => void) {
  const onChange = () => listener();
  window.addEventListener("storage", onChange);
  window.addEventListener(PREFERENCES_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(PREFERENCES_EVENT, onChange);
  };
}

function notifyPreferenceChange() {
  window.dispatchEvent(new Event(PREFERENCES_EVENT));
}

export interface PreferencesProviderProps {
  children: ReactNode;
}

export function PreferencesProvider({ children }: PreferencesProviderProps) {
  const snapshot = useSyncExternalStore(subscribeToPreferences, readPreferencesSnapshot, () => "dark|off");
  const ready = useSyncExternalStore(
    () => () => undefined,
    () => true,
    () => false,
  );
  const [themeToken, soundToken] = snapshot.split("|");
  const theme: ThemePreference = themeToken === "light" ? "light" : "dark";
  const soundEnabled = soundToken === "on";

  useEffect(() => {
    applyTheme(theme);
    applySound(soundEnabled);
  }, [soundEnabled, theme]);

  const setTheme = useCallback((nextTheme: ThemePreference) => {
    applyTheme(nextTheme);
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
    } catch {
      // Keep the preference for the current session when storage is unavailable.
    }
    notifyPreferenceChange();
  }, []);

  const setSoundEnabled = useCallback((enabled: boolean) => {
    applySound(enabled);
    try {
      window.localStorage.setItem(SOUND_STORAGE_KEY, enabled ? "on" : "off");
    } catch {
      // Keep the preference for the current session when storage is unavailable.
    }
    notifyPreferenceChange();
  }, []);

  const playSound = useCallback(
    (name: UiSoundName = "select") => {
      if (soundEnabled) playAudio(name);
    },
    [soundEnabled],
  );

  const toggleTheme = useCallback(() => {
    if (soundEnabled) playAudio("theme");
    setTheme(theme === "dark" ? "light" : "dark");
  }, [setTheme, soundEnabled, theme]);

  const toggleSound = useCallback(() => {
    if (soundEnabled) {
      playAudio("select");
      setSoundEnabled(false);
    } else {
      setSoundEnabled(true);
      // This call happens during the activating click and is therefore opt-in safe.
      playAudio("select");
    }
  }, [setSoundEnabled, soundEnabled]);

  const value = useMemo<PreferencesContextValue>(
    () => ({
      theme,
      soundEnabled,
      ready,
      setTheme,
      toggleTheme,
      setSoundEnabled,
      toggleSound,
      playSound,
    }),
    [playSound, ready, setSoundEnabled, setTheme, soundEnabled, theme, toggleSound, toggleTheme],
  );

  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}

export function usePreferences() {
  const context = useContext(PreferencesContext);
  if (!context) throw new Error("usePreferences must be used within PreferencesProvider");
  return context;
}

export interface ThemeSoundControlsProps {
  className?: string;
}

export function ThemeSoundControls({ className = "" }: ThemeSoundControlsProps) {
  const { theme, soundEnabled, ready, toggleTheme, toggleSound } = usePreferences();
  const nextThemeLabel = theme === "dark" ? "Cambiar a tema claro" : "Cambiar a tema oscuro";
  const soundLabel = soundEnabled ? "Desactivar sonidos" : "Activar sonidos";

  return (
    <div
      className={`q-preference-controls ${className}`.trim()}
      aria-label="Preferencias de interfaz"
      data-ready={ready ? "true" : "false"}
    >
      <button
        type="button"
        className="q-icon-button"
        onClick={toggleTheme}
        aria-label={nextThemeLabel}
        title={nextThemeLabel}
        aria-pressed={theme === "light"}
        data-testid="theme-toggle"
        disabled={!ready}
      >
        <Icon name={theme === "dark" ? "sun" : "moon"} size={19} />
      </button>
      <button
        type="button"
        className="q-icon-button"
        onClick={toggleSound}
        aria-label={soundLabel}
        title={soundLabel}
        aria-pressed={soundEnabled}
        data-indicator={soundEnabled ? "true" : undefined}
        data-testid="sound-toggle"
        disabled={!ready}
      >
        <Icon name="sound" size={19} />
      </button>
    </div>
  );
}
