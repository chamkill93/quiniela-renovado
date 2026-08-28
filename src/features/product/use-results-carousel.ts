"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";

export function useResultsCarousel<T extends HTMLElement = HTMLDivElement>() {
  const trackRef = useRef<T>(null);
  const [navigation, setNavigation] = useState({ previous: false, next: false });

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;

    const updateNavigation = () => {
      const end = Math.max(0, track.scrollWidth - track.clientWidth);
      const previous = track.scrollLeft > 1;
      const next = track.scrollLeft < end - 1;
      setNavigation((current) => current.previous === previous && current.next === next
        ? current
        : { previous, next });
    };
    const frame = window.requestAnimationFrame(updateNavigation);
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(updateNavigation);
    observer?.observe(track);
    if (track.firstElementChild) observer?.observe(track.firstElementChild);
    track.addEventListener("scroll", updateNavigation, { passive: true });
    window.addEventListener("resize", updateNavigation);

    return () => {
      window.cancelAnimationFrame(frame);
      observer?.disconnect();
      track.removeEventListener("scroll", updateNavigation);
      window.removeEventListener("resize", updateNavigation);
    };
  }, []);

  function scrollPage(direction: -1 | 1) {
    const track = trackRef.current;
    if (!track || track.clientWidth <= 0) return;
    const first = track.firstElementChild as HTMLElement | null;
    const second = first?.nextElementSibling as HTMLElement | null;
    const cardWidth = first?.getBoundingClientRect().width ?? 0;
    const stride = first && second ? second.offsetLeft - first.offsetLeft : cardWidth;
    const gap = Math.max(0, stride - cardWidth);
    // Advance only fully visible cards so a partially shown position is not skipped.
    const distance = stride > 0
      ? Math.max(1, Math.floor((track.clientWidth + gap) / stride)) * stride
      : track.clientWidth;
    track.scrollBy({ left: direction * distance });
  }

  function handleKeyDown(event: KeyboardEvent<T>) {
    if (event.target !== event.currentTarget || event.altKey || event.ctrlKey || event.metaKey) return;
    const track = trackRef.current;
    if (!track) return;

    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      event.preventDefault();
      scrollPage(event.key === "ArrowLeft" ? -1 : 1);
    } else if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      track.scrollTo({ left: event.key === "Home" ? 0 : Math.max(0, track.scrollWidth - track.clientWidth) });
    }
  }

  return { trackRef, navigation, scrollPage, handleKeyDown };
}
