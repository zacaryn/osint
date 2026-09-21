import type { ReactNode } from "react";

type Props = {
  title: string;
  open: boolean;
  onToggle: () => void;
  /** id of the region this header folds. */
  controls: string;
  children?: ReactNode;
};

/** Desktop-only fold bar for a board pane; hidden on phones by CSS. */
export default function PaneHeader({ title, open, onToggle, controls, children }: Props) {
  return (
    <div className={`panehead ${open ? "" : "is-folded"}`}>
      <button
        type="button"
        className="panehead__btn"
        aria-expanded={open}
        aria-controls={controls}
        title={open ? `Fold the ${title} pane` : `Unfold the ${title} pane`}
        onClick={onToggle}
      >
        <span aria-hidden="true">{open ? "▾" : "▸"}</span>
        <span className="panehead__title">{title}</span>
      </button>
      {open && children ? <div className="panehead__aside">{children}</div> : null}
    </div>
  );
}
