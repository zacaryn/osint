import { useEffect, useRef, type ReactNode } from "react";

type Props = {
  title: string;
  open: boolean;
  onClose: () => void;
  /** "modal" keeps the sheet available on desktop as a centred dialog. */
  variant?: "sheet" | "modal";
  children: ReactNode;
};

/** Modal bottom sheet: closes on Escape or backdrop tap, and traps initial focus. */
export default function Sheet({ title, open, onClose, variant = "sheet", children }: Props) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Keyed on `open` alone: an onClose that changes identity every render must
  // not be allowed to pull focus back out of the sheet.
  useEffect(() => {
    if (!open) return;
    const opener = document.activeElement as HTMLElement | null;
    panelRef.current?.focus();
    return () => opener?.focus?.();
  }, [open]);

  if (!open) return null;

  const suffix = variant === "modal" ? " sheet--modal" : "";

  return (
    <>
      <div className={`sheet-backdrop${suffix ? " sheet-backdrop--modal" : ""}`} onClick={onClose} />
      <div
        className={`sheet${suffix}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        ref={panelRef}
        tabIndex={-1}
      >
        <div className="sheet__head">
          <h2 className="sheet__title">{title}</h2>
          <button type="button" className="iconbtn" onClick={onClose}>
            Close
          </button>
        </div>
        <div className="sheet__body">{children}</div>
      </div>
    </>
  );
}
