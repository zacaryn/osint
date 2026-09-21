import type { MouseEvent } from "react";
import { useCopy } from "../useCopy";

type Props = {
  /** Copied on a plain click. */
  text: string;
  /** Copied when Shift is held, for a citation with title and source. */
  altText?: string;
  /** Names the thing being copied, e.g. "link to this article". */
  what?: string;
  /** Shows a text label next to the glyph instead of an icon-only control. */
  label?: string;
  className?: string;
};

const GLYPH = { idle: "⧉", copied: "✓", failed: "!" } as const;

/**
 * The only place clipboard behaviour lives. Rows in the lists are links or
 * buttons themselves, so this stops the click from also opening the story.
 */
export default function CopyButton({ text, altText, what = "link", label, className }: Props) {
  const { state, copy } = useCopy();

  const hint = altText
    ? `Copy ${what} — hold Shift to copy title, source and link`
    : `Copy ${what}`;

  const onClick = (e: MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    copy(e.shiftKey && altText ? altText : text);
  };

  return (
    <button
      type="button"
      className={`copybtn ${className ?? ""}`}
      data-state={state}
      title={hint}
      aria-label={hint}
      onClick={onClick}
    >
      <span aria-hidden="true">{GLYPH[state]}</span>
      {label && <span className="copybtn__label">{state === "copied" ? "Copied" : label}</span>}
      <span className="visually-hidden" role="status" aria-live="polite">
        {state === "copied" ? "Copied to clipboard" : state === "failed" ? "Copy failed" : ""}
      </span>
    </button>
  );
}

/** Title + source + link, for the Shift-click payload on article rows. */
export function citation(title: string, source: string, url: string): string {
  return `${title}\n${source}\n${url}`;
}
