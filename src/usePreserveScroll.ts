import { useLayoutEffect, useRef, type RefObject, type UIEventHandler } from "react";
import L from "leaflet";

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

const PATCHED = "__osintPopupScroll";

type PopupWithNode = L.Popup & { _contentNode?: HTMLElement };

/**
 * react-leaflet calls Popup.update() whenever popup children change.
 * Leaflet clears the content height during that layout pass, which zeros
 * scrollTop, and it runs after React effects. Restore at the end of update().
 */
export function keepLeafletPopupScroll(): void {
  const proto = L.Popup.prototype as PopupWithNode & { update: () => unknown } & Record<string, unknown>;
  if (proto[PATCHED]) return;
  const orig = proto.update;
  proto.update = function updateKeepingScroll(this: PopupWithNode) {
    const content = this._contentNode ?? null;
    const wrapper = this.getElement()?.querySelector(".leaflet-popup-content-wrapper") as HTMLElement | null;
    const saved: Array<[HTMLElement, number]> = [];
    if (content && content.scrollTop > 1) saved.push([content, content.scrollTop]);
    if (wrapper && wrapper.scrollTop > 1) saved.push([wrapper, wrapper.scrollTop]);
    const ret = orig.call(this);
    for (const [el, top] of saved) {
      if (el.isConnected && Math.abs(el.scrollTop - top) > 1) el.scrollTop = top;
    }
    return ret;
  };
  proto[PATCHED] = true;
}

/** Stable root for popup content. Scroll survival is handled by keepLeafletPopupScroll. */
export function useLeafletPopupScrollRoot(scrollKey: string): RefObject<HTMLDivElement> {
  void scrollKey;
  return useRef<HTMLDivElement>(null!);
}
