"use client";

import Image from "next/image";
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";

import type { HomeResultPositionView } from "./home-sections-data";
import styles from "./home-sections.module.css";

const RESULT_PAGE_COUNT = 4;

const BALL_ART = {
  gold: "/assets/results/balls/ball-gold.webp",
  red: "/assets/results/balls/ball-red.webp",
} as const;

const PAGINATION_ART = {
  active: "/assets/results/ui/carousel-indicator-active.svg",
  inactive: "/assets/results/ui/carousel-indicator-inactive.svg",
} as const;

type BallTone = keyof typeof BALL_ART;

interface DragState {
  pointerId: number;
  startScrollLeft: number;
  startX: number;
}

function toneForPosition(position: number): BallTone {
  return position === 1 ? "gold" : "red";
}

function formattedResult(value: string | null) {
  return value === null ? null : String(value).padStart(3, "0");
}

function ResultBall({ result }: { result: HomeResultPositionView }) {
  const entryIndex = 14 - result.position;
  const value = formattedResult(result.value);
  const tone = toneForPosition(result.position);
  const resultLabel = value === null ? "pendiente" : `número ${value}`;

  return (
    <li
      aria-label={`${result.position}.ª postura: ${resultLabel}`}
      className={styles.resultBall}
      data-entry-order={entryIndex + 1}
      data-pending={value === null ? "true" : "false"}
      data-position={result.position}
      data-testid="home-result-card"
      data-tone={tone}
    >
      <div className={styles.resultBallArt}>
        <Image
          alt=""
          aria-hidden="true"
          className={styles.resultBallImage}
          draggable={false}
          height={384}
          priority={result.position === 1}
          src={BALL_ART[tone]}
          unoptimized
          width={384}
        />
        <strong className={styles.resultBallValue} data-testid="home-result-value">
          {value ?? "—"}
        </strong>
      </div>
      <span aria-hidden="true" className={styles.resultBallPosture} data-testid="home-result-posture">
        {result.position}ª POSTURA
      </span>
    </li>
  );
}

export function HomeLatestResultsCarousel({
  results,
}: {
  results: readonly HomeResultPositionView[];
}) {
  const trackId = useId();
  const trackRef = useRef<HTMLOListElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const [activePage, setActivePage] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [navigation, setNavigation] = useState({ previous: false, next: false });

  const updateCarouselState = useCallback(() => {
    const track = trackRef.current;
    if (!track) return;
    const end = Math.max(0, track.scrollWidth - track.clientWidth);
    const previous = track.scrollLeft > 1;
    const next = track.scrollLeft < end - 1;
    const page = end <= 1
      ? 0
      : Math.min(RESULT_PAGE_COUNT - 1, Math.round((track.scrollLeft / end) * (RESULT_PAGE_COUNT - 1)));

    setNavigation((current) => current.previous === previous && current.next === next
      ? current
      : { previous, next });
    setActivePage((current) => current === page ? current : page);
  }, []);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;

    const initialFrame = window.requestAnimationFrame(updateCarouselState);
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(updateCarouselState);
    observer?.observe(track);
    if (track.firstElementChild) observer?.observe(track.firstElementChild);
    track.addEventListener("scroll", updateCarouselState, { passive: true });
    window.addEventListener("resize", updateCarouselState);

    return () => {
      window.cancelAnimationFrame(initialFrame);
      observer?.disconnect();
      track.removeEventListener("scroll", updateCarouselState);
      window.removeEventListener("resize", updateCarouselState);
    };
  }, [updateCarouselState]);

  function scrollPage(direction: -1 | 1) {
    const track = trackRef.current;
    if (!track || track.clientWidth <= 0) return;
    const first = track.firstElementChild as HTMLElement | null;
    const second = first?.nextElementSibling as HTMLElement | null;
    const cardWidth = first?.getBoundingClientRect().width ?? 0;
    const stride = first && second ? second.offsetLeft - first.offsetLeft : cardWidth;
    const gap = Math.max(0, stride - cardWidth);
    const distance = stride > 0
      ? Math.max(1, Math.floor((track.clientWidth + gap) / stride)) * stride
      : track.clientWidth;
    track.scrollBy({ behavior: "smooth", left: direction * distance });
  }

  function handleKeyDown(event: KeyboardEvent<HTMLOListElement>) {
    if (event.target !== event.currentTarget || event.altKey || event.ctrlKey || event.metaKey) return;
    const track = trackRef.current;
    if (!track) return;

    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      event.preventDefault();
      scrollPage(event.key === "ArrowLeft" ? -1 : 1);
    } else if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      track.scrollTo({
        behavior: "smooth",
        left: event.key === "Home" ? 0 : Math.max(0, track.scrollWidth - track.clientWidth),
      });
    }
  }

  function finishMouseDrag(event: ReactPointerEvent<HTMLOListElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    dragRef.current = null;
    setDragging(false);
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    updateCarouselState();
  }

  return (
    <div
      className={styles.latestResultsCarousel}
      data-has-next={navigation.next ? "true" : "false"}
      data-testid="home-results-carousel"
    >
      <button
        aria-controls={trackId}
        aria-label="Ver resultados anteriores"
        className={styles.latestResultsArrow}
        data-direction="previous"
        data-testid="home-results-previous"
        disabled={!navigation.previous}
        onClick={() => scrollPage(-1)}
        type="button"
      >
        <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24">
          <path d="m14 6-6 6 6 6" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
        </svg>
      </button>

      <ol
        aria-label="Las 14 posturas del último sorteo publicado"
        aria-roledescription="carrusel"
        className={styles.resultBalls}
        data-dragging={dragging ? "true" : "false"}
        data-testid="home-results-balls"
        id={trackId}
        onKeyDown={handleKeyDown}
        onLostPointerCapture={(event) => finishMouseDrag(event)}
        onPointerCancel={(event) => finishMouseDrag(event)}
        onPointerDown={(event) => {
          if (event.pointerType !== "mouse" || event.button !== 0) return;
          dragRef.current = {
            pointerId: event.pointerId,
            startScrollLeft: event.currentTarget.scrollLeft,
            startX: event.clientX,
          };
          event.currentTarget.setPointerCapture?.(event.pointerId);
          setDragging(true);
        }}
        onPointerMove={(event) => {
          const drag = dragRef.current;
          if (!drag || drag.pointerId !== event.pointerId) return;
          event.preventDefault();
          event.currentTarget.scrollLeft = drag.startScrollLeft + drag.startX - event.clientX;
          updateCarouselState();
        }}
        onPointerUp={(event) => finishMouseDrag(event)}
        ref={trackRef}
        tabIndex={0}
      >
        {results.map((result) => <ResultBall key={result.position} result={result} />)}
      </ol>

      <button
        aria-controls={trackId}
        aria-label="Ver resultados siguientes"
        className={styles.latestResultsArrow}
        data-direction="next"
        data-testid="home-results-next"
        disabled={!navigation.next}
        onClick={() => scrollPage(1)}
        type="button"
      >
        <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24">
          <path d="m10 6 6 6-6 6" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
        </svg>
      </button>

      <div aria-hidden="true" className={styles.latestResultsPagination} data-testid="home-results-pagination">
        {Array.from({ length: RESULT_PAGE_COUNT }, (_, page) => {
          const active = page === activePage;
          return (
            <span
              className={styles.latestResultsSegment}
              data-active={active ? "true" : "false"}
              data-testid="home-results-pagination-segment"
              key={page}
            >
              <Image
                alt=""
                aria-hidden="true"
                className={styles.latestResultsSegmentImage}
                fill
                sizes={active ? "42px" : "24px"}
                src={active ? PAGINATION_ART.active : PAGINATION_ART.inactive}
              />
            </span>
          );
        })}
      </div>
    </div>
  );
}
