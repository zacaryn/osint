import L from "leaflet";
import { LayerGroup, Marker, Popup } from "react-leaflet";
import {
  SEVERITY_COLOR,
  generalSeverity,
  restrictedTargets,
  type ChokepointStatus,
  type RestrictedTarget,
} from "@shared/chokepoints";
import type { ChokepointReport } from "@shared/types";
import ChokepointPopup from "./ChokepointPopup";
import { rgba } from "./paint";

const BOX = 30;
const CENTER = BOX / 2;
const RING_RADIUS = 12;
const PIP = 5;
/** Beyond this the ring stops reading as a ring and starts reading as clutter. */
const MAX_PIPS = 6;

/**
 * One pip per restricted actor, evenly spaced from the top. The ring is what
 * lets a passage read as "open, except to Russia" at a glance — a single badge
 * cannot say that.
 */
function pipRing(targets: RestrictedTarget[]): string {
  const shown = targets.slice(0, MAX_PIPS);
  return shown
    .map((t, i) => {
      const angle = -Math.PI / 2 + (i * 2 * Math.PI) / Math.max(shown.length, 1);
      const left = CENTER + RING_RADIUS * Math.cos(angle) - PIP / 2;
      const top = CENTER + RING_RADIUS * Math.sin(angle) - PIP / 2;
      return `<i class="cpin__pip" style="left:${left.toFixed(1)}px;top:${top.toFixed(
        1,
      )}px;background:${t.color}"></i>`;
    })
    .join("");
}

function iconFor(cp: ChokepointStatus, targets: RestrictedTarget[]): L.DivIcon {
  const severity = generalSeverity(cp);
  const color = SEVERITY_COLOR[severity];
  const alarmed = severity === "denied" || severity === "closed";
  const extra = targets.length > MAX_PIPS ? `<span class="cpin__more mono">+${targets.length - MAX_PIPS}</span>` : "";
  const label = targets.length > 0 || severity !== "open" ? `<span class="cpin__label mono">${cp.short}</span>` : "";

  return L.divIcon({
    className: "",
    iconSize: [0, 0],
    html: `<div class="cpin ${alarmed ? "is-alarmed" : ""}" style="--cp:${color};--cp-fill:${rgba(color, 0.32)}">
             <span class="cpin__core"></span>
             ${pipRing(targets)}
             ${extra}
             ${label}
           </div>`,
  });
}

/**
 * Leaflet needs a fixed pixel cap, so derive one from the viewport rather than
 * hardcoding: a phone needs the list to scroll in place, a desktop does not.
 */
function popupMaxHeight(): number {
  const h = typeof window === "undefined" ? 800 : window.innerHeight;
  return Math.round(Math.min(460, Math.max(260, h * 0.42)));
}

/**
 * Maritime chokepoint access status: a severity-filled core for restrictions
 * that apply to every flag, ringed by one flag-coloured pip per named actor.
 */
export default function ChokepointLayer({
  chokepoints,
  reports,
}: {
  chokepoints: ChokepointStatus[];
  reports: Map<string, ChokepointReport>;
}) {
  const maxHeight = popupMaxHeight();

  return (
    <LayerGroup>
      {chokepoints.map((cp) => {
        const targets = restrictedTargets(cp);
        const restricted = targets.length
          ? `restricted for ${targets.map((t) => t.iso3).join(", ")}`
          : "no restriction on record";
        return (
          <Marker
            key={cp.id}
            position={[cp.lat, cp.lon]}
            icon={iconFor(cp, targets)}
            // Keeps the pip ring readable where a tripwire marks the same strait.
            zIndexOffset={500}
            title={`${cp.name} — ${generalSeverity(cp)}, ${restricted}`}
            alt={`${cp.name} chokepoint status`}
          >
            {/*
              A full restriction list runs past a phone viewport, so it scrolls
              in place, and the top padding clears the floating chip strip that
              would otherwise cover the title.
            */}
            <Popup
              maxWidth={320}
              minWidth={240}
              maxHeight={maxHeight}
              autoPanPaddingTopLeft={[10, 64]}
              autoPanPaddingBottomRight={[10, 16]}
            >
              <ChokepointPopup cp={cp} report={reports.get(cp.id)} />
            </Popup>
          </Marker>
        );
      })}
    </LayerGroup>
  );
}
