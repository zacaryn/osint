import type { ReactNode } from "react";
import { useLeafletPopupScrollRoot } from "../../usePreserveScroll";

/** Wrap Leaflet popup content so polling re-renders do not reset popup scroll. */
export default function PopupScrollRoot({
  scrollKey,
  children,
}: {
  scrollKey: string;
  children: ReactNode;
}) {
  const rootRef = useLeafletPopupScrollRoot(scrollKey);
  return <div ref={rootRef}>{children}</div>;
}
