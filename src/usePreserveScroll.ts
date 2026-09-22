import { useLayoutEffect, useRef, type RefObject, type UIEventHandler } from "react";

/**
 * Keeps a scroll container's position when parent re-renders from polling.
 * Attach ref to the element that actually scrolls (panel body or popup content).
 */
export function usePreserveScroll<T extends HTMLElement>(): {
  ref: RefObject<T>;
  onScroll: UIEventHandler<T>;
} {
  const ref = useRef<T>(null!);
  const top = useRef(0);

  useLayoutEffect(() => {
    const el = ref.current;
    if (el && el.scrollTop !== top.current) el.scrollTop = top.current;
  });

  const onScroll: UIEventHandler<T> = (e) => {
    top.current = e.currentTarget.scrollTop;
  };

  return { ref, onScroll };
}

/** Per-popup scroll positions survive React re-renders and Leaflet content refresh. */
const leafletPopupScrollTops = new Map<string, number>();

function leafletPopupScrollEl(from: HTMLElement | null): HTMLElement | null {
  if (!from) return null;
  const wrapper = from.closest(".leaflet-popup-content-wrapper") as HTMLElement | null;
  const content = from.closest(".leaflet-popup-content") as HTMLElement | null;
  if (wrapper && wrapper.scrollHeight > wrapper.clientHeight + 1) return wrapper;
  if (content && content.scrollHeight > content.clientHeight + 1) return content;
  return wrapper ?? content;
}

/**
 * Leaflet puts overflow on `.leaflet-popup-content-wrapper` (or `.leaflet-popup-content`).
 * React re-renders often reset scrollTop to 0 before paint — restore from a stable key.
 */
export function useLeafletPopupScrollRoot(scrollKey: string): RefObject<HTMLDivElement> {
  const rootRef = useRef<HTMLDivElement>(null!);
  const ignoreScroll = useRef(false);

  useLayoutEffect(() => {
    const popup = leafletPopupScrollEl(rootRef.current);
    if (!popup) return;

    const saved = leafletPopupScrollTops.get(scrollKey) ?? 0;
    if (Math.abs(popup.scrollTop - saved) > 1) {
      ignoreScroll.current = true;
      popup.scrollTop = saved;
      requestAnimationFrame(() => {
        ignoreScroll.current = false;
      });
    }

    const onScroll = () => {
      if (ignoreScroll.current) return;
      leafletPopupScrollTops.set(scrollKey, popup.scrollTop);
    };
    popup.addEventListener("scroll", onScroll, { passive: true });
    return () => popup.removeEventListener("scroll", onScroll);
  });

  return rootRef;
}
