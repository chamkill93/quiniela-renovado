"use client";

import { useId, type ReactNode } from "react";

import styles from "./home-sections.module.css";
import { useResultsCarousel } from "./use-results-carousel";

interface HomeResultsCarouselProps {
  children: ReactNode;
  label: string;
  modality: "prizes" | "redoblona" | "invert";
}

export function HomeResultsCarousel({ children, label, modality }: HomeResultsCarouselProps) {
  const trackId = useId();
  const { trackRef, navigation, scrollPage, handleKeyDown } = useResultsCarousel();

  return (
    <div className={styles.resultsCarousel} data-testid="home-results-carousel">
      <button
        aria-controls={trackId}
        aria-label="Ver resultados anteriores"
        className={styles.resultCarouselArrow}
        data-testid="home-results-previous"
        disabled={!navigation.previous}
        onClick={() => scrollPage(-1)}
        type="button"
      >
        <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24">
          <path d="m14 6-6 6 6 6" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
        </svg>
      </button>

      <div
        aria-label={`Resultados de ${label}`}
        aria-roledescription="carrusel"
        className={styles.resultsCarouselTrack}
        data-modality={modality}
        data-testid="home-results-carousel-track"
        id={trackId}
        onKeyDown={handleKeyDown}
        ref={trackRef}
        role="group"
        tabIndex={0}
      >
        {children}
      </div>

      <button
        aria-controls={trackId}
        aria-label="Ver resultados siguientes"
        className={styles.resultCarouselArrow}
        data-testid="home-results-next"
        disabled={!navigation.next}
        onClick={() => scrollPage(1)}
        type="button"
      >
        <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24">
          <path d="m10 6 6 6-6 6" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
        </svg>
      </button>
    </div>
  );
}
