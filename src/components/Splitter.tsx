import { useRef, useState, type PointerEvent as ReactPointerEvent, type KeyboardEvent } from "react";

type Props = {
  /** "vertical" is a vertical bar that resizes a width. */
  orientation: "vertical" | "horizontal";
  label: string;
  value: number;
  min: number;
  max: number;
  /** Pointer position to pane size, measured against the grid it divides. */
  sizeFrom: (clientX: number, clientY: number) => number;
  onResize: (px: number) => void;
};

const STEP = 16;

/** Drag or arrow-key handle between two desktop panes. */
export default function Splitter({ orientation, label, value, min, max, sizeFrom, onResize }: Props) {
  const [dragging, setDragging] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    ref.current?.setPointerCapture(e.pointerId);
    setDragging(true);
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragging) return;
    onResize(sizeFrom(e.clientX, e.clientY));
  };

  const stop = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragging) return;
    setDragging(false);
    if (ref.current?.hasPointerCapture(e.pointerId)) ref.current.releasePointerCapture(e.pointerId);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const grow = orientation === "vertical" ? "ArrowLeft" : "ArrowUp";
    const shrink = orientation === "vertical" ? "ArrowRight" : "ArrowDown";
    if (e.key === grow) onResize(value + STEP);
    else if (e.key === shrink) onResize(value - STEP);
    else if (e.key === "Home") onResize(max);
    else if (e.key === "End") onResize(min);
    else return;
    e.preventDefault();
  };

  return (
    <div
      ref={ref}
      className={`splitter splitter--${orientation} ${dragging ? "is-dragging" : ""}`}
      role="separator"
      tabIndex={0}
      aria-label={label}
      aria-orientation={orientation}
      aria-valuenow={Math.round(value)}
      aria-valuemin={min}
      aria-valuemax={max}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={stop}
      onPointerCancel={stop}
      onKeyDown={onKeyDown}
      onDoubleClick={() => onResize(orientation === "vertical" ? 380 : 320)}
    />
  );
}
