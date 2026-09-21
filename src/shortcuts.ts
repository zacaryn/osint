import { useEffect, useRef } from "react";

export type Hotkeys = Record<string, () => void>;

const TYPING = /^(INPUT|TEXTAREA|SELECT)$/;

/** Single-key shortcuts that stay out of the way while the user is typing. */
export function useHotkeys(keys: Hotkeys): void {
  const latest = useRef(keys);
  latest.current = keys;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (target && (target.isContentEditable || TYPING.test(target.tagName))) return;
      const handler = latest.current[e.key];
      if (!handler) return;
      e.preventDefault();
      handler();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}

export const SHORTCUTS: { keys: string; what: string }[] = [
  { keys: "1 / 2 / 3", what: "Phone: map, feed, intel. Desktop: restore board, fold the deck, fold the intel panel." },
  { keys: "?", what: "Open this panel." },
  { keys: "r", what: "Refresh every channel now." },
  { keys: "/", what: "Jump to the place search." },
  { keys: "Esc", what: "Close a sheet or panel." },
  { keys: "Shift + ⧉", what: "Copy title, source and link instead of the link alone." },
];
