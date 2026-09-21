import { useCallback, useMemo, type CSSProperties } from "react";
import {
  DEFAULT_LAYOUT,
  LAYOUT_LIMITS,
  clamp,
  reviveLayout,
  usePersisted,
  type BoardLayout,
} from "./prefs";

export type BoardLayoutApi = {
  layout: BoardLayout;
  bodyClass: string;
  bodyStyle: CSSProperties;
  toggleIntel: () => void;
  toggleDeck: () => void;
  restore: () => void;
  setIntelWidth: (px: number) => void;
  setDeckHeight: (px: number) => void;
};

/** Desktop pane sizing and folding, persisted so the board comes back as left. */
export function useBoardLayout(): BoardLayoutApi {
  const [layout, setLayout] = usePersisted<BoardLayout>("layout", DEFAULT_LAYOUT, reviveLayout);

  const setIntelWidth = useCallback(
    (px: number) =>
      setLayout((prev) => ({
        ...prev,
        intelWidth: clamp(Math.round(px), LAYOUT_LIMITS.intelMin, LAYOUT_LIMITS.intelMax),
      })),
    [setLayout],
  );

  const setDeckHeight = useCallback(
    (px: number) =>
      setLayout((prev) => ({
        ...prev,
        deckHeight: clamp(Math.round(px), LAYOUT_LIMITS.deckMin, LAYOUT_LIMITS.deckMax),
      })),
    [setLayout],
  );

  const toggleIntel = useCallback(
    () => setLayout((prev) => ({ ...prev, intelOpen: !prev.intelOpen })),
    [setLayout],
  );

  const toggleDeck = useCallback(
    () => setLayout((prev) => ({ ...prev, deckOpen: !prev.deckOpen })),
    [setLayout],
  );

  const restore = useCallback(
    () => setLayout((prev) => ({ ...prev, intelOpen: true, deckOpen: true })),
    [setLayout],
  );

  const bodyClass = [
    layout.intelOpen ? "" : "is-intel-folded",
    layout.deckOpen ? "" : "is-deck-folded",
  ]
    .filter(Boolean)
    .join(" ");

  const bodyStyle = useMemo<CSSProperties>(
    () => ({
      ["--intel-w" as string]: `${layout.intelWidth}px`,
      ["--deck-h" as string]: `${layout.deckHeight}px`,
    }),
    [layout.intelWidth, layout.deckHeight],
  );

  return { layout, bodyClass, bodyStyle, toggleIntel, toggleDeck, restore, setIntelWidth, setDeckHeight };
}
