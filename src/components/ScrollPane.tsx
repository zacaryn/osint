import type { ReactNode } from "react";
import { usePreserveScroll } from "../usePreserveScroll";

type Props = {
  className?: string;
  children: ReactNode;
};

/** Scrollable panel region that survives live-feed re-renders without jumping to top. */
export default function ScrollPane({ className = "scroll-y", children }: Props) {
  const { ref, onScroll } = usePreserveScroll<HTMLDivElement>();
  return (
    <div ref={ref} className={className} onScroll={onScroll}>
      {children}
    </div>
  );
}
