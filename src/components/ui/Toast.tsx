"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Icon, type IconName } from "./Icon";

export type ToastVariant = "info" | "success" | "warning" | "error";

export interface ToastInput {
  title: string;
  description?: string;
  variant?: ToastVariant;
  duration?: number;
}

interface ToastRecord extends Required<Pick<ToastInput, "title" | "variant">> {
  id: number;
  description?: string;
}

interface ToastContextValue {
  notify: (toast: ToastInput) => number;
  dismiss: (id: number) => void;
  dismissAll: () => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const toastIcons: Record<ToastVariant, IconName> = {
  info: "info",
  success: "check",
  warning: "warning",
  error: "error",
};

export interface ToastProviderProps {
  children: ReactNode;
  maxVisible?: number;
}

export function ToastProvider({ children, maxVisible = 4 }: ToastProviderProps) {
  const [toasts, setToasts] = useState<ToastRecord[]>([]);
  const nextId = useRef(0);
  const timers = useRef(new Map<number, number>());

  const dismiss = useCallback((id: number) => {
    const timer = timers.current.get(id);
    if (timer) window.clearTimeout(timer);
    timers.current.delete(id);
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const dismissAll = useCallback(() => {
    for (const timer of timers.current.values()) window.clearTimeout(timer);
    timers.current.clear();
    setToasts([]);
  }, []);

  useEffect(() => dismissAll, [dismissAll]);

  const notify = useCallback(
    ({ title, description, variant = "info", duration = 4500 }: ToastInput) => {
      const id = ++nextId.current;
      const toast: ToastRecord = { id, title, description, variant };
      setToasts((current) => [...current.slice(-(maxVisible - 1)), toast]);

      if (duration > 0) {
        const timer = window.setTimeout(() => dismiss(id), duration);
        timers.current.set(id, timer);
      }
      return id;
    },
    [dismiss, maxVisible],
  );

  const value = useMemo(() => ({ notify, dismiss, dismissAll }), [dismiss, dismissAll, notify]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <section className="q-toast-region" aria-label="Notificaciones" aria-live="polite" aria-relevant="additions removals">
        {toasts.map((toast) => (
          <article key={toast.id} className={`q-toast q-toast--${toast.variant}`} role={toast.variant === "error" ? "alert" : "status"}>
            <span className="q-toast__icon" aria-hidden="true">
              <Icon name={toastIcons[toast.variant]} size={17} />
            </span>
            <div>
              <p className="q-toast__title">{toast.title}</p>
              {toast.description ? <p className="q-toast__description">{toast.description}</p> : null}
            </div>
            <button type="button" className="q-icon-button q-toast__close" onClick={() => dismiss(toast.id)} aria-label="Cerrar notificación">
              <Icon name="close" size={16} />
            </button>
          </article>
        ))}
      </section>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast must be used within ToastProvider");
  return context;
}
