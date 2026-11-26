import { type RefObject, useEffect } from 'react';

/** How long an announcement must stay on screen before it counts as seen. */
export const SEEN_AFTER_MS = 1000;
/** How much of it must be visible. */
export const SEEN_RATIO = 0.6;

/**
 * Calls `onSeen` once the element has been mostly visible for a moment, which is what "seen"
 * honestly means: scrolling quickly past an announcement does not count. Browsers without
 * IntersectionObserver count it as seen when shown.
 */
export function useSeenOnView(
  ref: RefObject<HTMLElement | null>,
  active: boolean,
  onSeen: () => void,
) {
  useEffect(() => {
    const element = ref.current;
    if (!active || !element) return;
    if (typeof IntersectionObserver === 'undefined') {
      onSeen();
      return;
    }
    let timer: ReturnType<typeof setTimeout> | undefined;
    const observer = new IntersectionObserver(
      ([entry]) => {
        clearTimeout(timer);
        if (entry?.isIntersecting && entry.intersectionRatio >= SEEN_RATIO) {
          timer = setTimeout(() => {
            observer.disconnect();
            onSeen();
          }, SEEN_AFTER_MS);
        }
      },
      { threshold: [SEEN_RATIO] },
    );
    observer.observe(element);
    return () => {
      clearTimeout(timer);
      observer.disconnect();
    };
  }, [ref, active, onSeen]);
}
