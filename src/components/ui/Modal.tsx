"use client";

import {
  useEffect,
  useId,
  useRef,
  useSyncExternalStore,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { Icon } from "./Icon";

export interface ModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
  closeLabel?: string;
  closeOnBackdrop?: boolean;
  initialFocusRef?: React.RefObject<HTMLElement | null>;
}

const FOCUSABLE = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

export function Modal({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  size = "md",
  closeLabel = "Cerrar",
  closeOnBackdrop = true,
  initialFocusRef,
}: ModalProps) {
  const mounted = useSyncExternalStore(
    () => () => undefined,
    () => true,
    () => false,
  );
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    if (!open) return;
    previousFocusRef.current = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const frame = window.requestAnimationFrame(() => {
      const preferred = initialFocusRef?.current;
      const firstFocusable = dialogRef.current?.querySelector<HTMLElement>(FOCUSABLE);
      (preferred ?? firstFocusable ?? dialogRef.current)?.focus();
    });

    return () => {
      window.cancelAnimationFrame(frame);
      document.body.style.overflow = previousOverflow;
      previousFocusRef.current?.focus();
    };
  }, [initialFocusRef, open]);

  if (!mounted || !open) return null;

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      onOpenChange(false);
      return;
    }

    if (event.key !== "Tab") return;
    const focusable = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []);
    if (focusable.length === 0) {
      event.preventDefault();
      dialogRef.current?.focus();
      return;
    }

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  return createPortal(
    <div className="q-modal-layer">
      <div
        className="q-modal__backdrop"
        aria-hidden="true"
        onMouseDown={() => {
          if (closeOnBackdrop) onOpenChange(false);
        }}
      />
      <div
        ref={dialogRef}
        className={`q-modal q-modal--${size}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
        onKeyDown={handleKeyDown}
      >
        <header className="q-modal__header">
          <div>
            <h2 id={titleId} className="q-modal__title">{title}</h2>
            {description ? <p id={descriptionId} className="q-modal__description">{description}</p> : null}
          </div>
          <button
            type="button"
            className="q-icon-button q-modal__close"
            onClick={() => onOpenChange(false)}
            aria-label={closeLabel}
            title={closeLabel}
          >
            <Icon name="close" size={18} />
          </button>
        </header>
        <div className="q-modal__body">{children}</div>
        {footer ? <footer className="q-modal__footer">{footer}</footer> : null}
      </div>
    </div>,
    document.body,
  );
}
