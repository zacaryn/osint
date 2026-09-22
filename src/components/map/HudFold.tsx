import type { ReactNode } from "react";

type Props = {
  id: string;
  label: string;
  detail?: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
};

/** One-line map key. Body stays closed until the reader opens it. */
export default function HudFold({ id, label, detail, open, onToggle, children }: Props) {
  return (
    <div className={`hudfold ${open ? "is-open" : "is-folded"}`}>
      <button
        type="button"
        className="hudfold__bar"
        aria-expanded={open}
        aria-controls={id}
        onClick={onToggle}
      >
        <span aria-hidden="true">{open ? "▾" : "▸"}</span>
        {label}
        {detail ? <span className="mapctl__count mono">{detail}</span> : null}
      </button>
      {open && (
        <div className="hudfold__body" id={id}>
          {children}
        </div>
      )}
    </div>
  );
}
