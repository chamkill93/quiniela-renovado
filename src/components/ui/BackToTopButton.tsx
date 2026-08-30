"use client";

import styles from "./BackToTopButton.module.css";

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

export interface BackToTopButtonProps {
  className?: string;
}

export function BackToTopButton({ className = "" }: BackToTopButtonProps) {
  function scrollToTop() {
    const prefersReducedMotion = window.matchMedia?.(REDUCED_MOTION_QUERY).matches ?? false;

    window.scrollTo({
      top: 0,
      behavior: prefersReducedMotion ? "auto" : "smooth",
    });
  }

  return (
    <button
      aria-label="Volver al inicio"
      className={`${styles.button} ${className}`.trim()}
      data-testid="back-to-top-button"
      onClick={scrollToTop}
      type="button"
    >
      <svg
        aria-hidden="true"
        className={styles.icon}
        focusable="false"
        viewBox="0 0 52 44"
      >
        <path
          className={styles.shape}
          d="M4.3 36.8 18.7 8.9C20.2 6 22.9 4.2 26 4.2S31.8 6 33.3 8.9l14.4 27.9c1.1 2.1-.4 4.7-2.8 4.7H7.1c-2.4 0-3.9-2.6-2.8-4.7Z"
        />
        <path
          className={styles.chevron}
          d="m17.7 27.3 8.3-8.4 8.3 8.4"
        />
      </svg>
    </button>
  );
}
