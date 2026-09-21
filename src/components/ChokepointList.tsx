import { useMemo } from "react";
import { chokepointsForZone } from "@shared/chokepoint-registry";
import {
  SEVERITY_COLOR,
  generalSeverity,
  peakSeverity,
  restrictedTargets,
  type ChokepointStatus,
} from "@shared/chokepoints";
import type { ChokepointReport, ChokepointTraffic } from "@shared/types";
import type { Zone } from "@shared/zones";

const SEVERITY_TAG: Record<string, string> = {
  open: "green",
  advisory: "yellow",
  conditional: "orange",
  denied: "red",
  closed: "red",
};

/**
 * Mirrors the popup: when the 28-day baseline has already absorbed a collapse,
 * the short-run ratio is noise, so the long-run comparison is what gets stated.
 */
function TrendText({ traffic }: { traffic: ChokepointTraffic }) {
  const { longRun } = traffic;
  if (traffic.quality === "low" && longRun) {
    return (
      <span className="cprow__trend" data-shift={longRun.shift}>
        <b>×{longRun.ratio.toFixed(2)}</b> vs its own {longRun.from.slice(0, 4)} mean · {traffic.recent}/day ·{" "}
        {traffic.dataDate}
      </span>
    );
  }
  return (
    <span className="cprow__trend" data-shift={longRun?.shift}>
      <b>×{traffic.ratio.toFixed(2)}</b> vs own baseline · {traffic.recent}/day · {traffic.dataDate}
      {longRun && longRun.shift !== "steady" ? ` · ${longRun.shift} long-run` : ""}
    </span>
  );
}

function Row({
  cp,
  report,
  onFocus,
}: {
  cp: ChokepointStatus;
  report?: ChokepointReport;
  onFocus: (lat: number, lon: number, zoom?: number) => void;
}) {
  const core = generalSeverity(cp);
  const peak = peakSeverity(cp);
  const pips = restrictedTargets(cp);
  const traffic = report?.traffic;

  return (
    <button type="button" className="row" onClick={() => onFocus(cp.lat, cp.lon, 7)}>
      <div className="row__top">
        <span className="cprow__left">
          <i className="cprow__dot" style={{ background: SEVERITY_COLOR[core] }} />
          <span className="row__title">{cp.name}</span>
        </span>
        <span className={`tag tag--${SEVERITY_TAG[peak] ?? "grey"}`}>{peak}</span>
      </div>
      {pips.length > 0 && (
        <span className="cprow__trend">
          <span className="cprow__pips">
            {pips.map((p) => (
              <i key={p.iso3} style={{ background: p.color }} />
            ))}
          </span>{" "}
          {pips.map((p) => p.iso3).join(" ")} restricted
        </span>
      )}
      {traffic && <TrendText traffic={traffic} />}
    </button>
  );
}

/** Zone-scoped access status, ordered worst first so the problems lead. */
export default function ChokepointList({
  zone,
  reports,
  onFocus,
}: {
  zone: Zone;
  reports: ChokepointReport[];
  onFocus: (lat: number, lon: number, zoom?: number) => void;
}) {
  const byId = useMemo(() => new Map(reports.map((r) => [r.id, r])), [reports]);
  const shown = useMemo(() => {
    const order = { closed: 0, denied: 1, conditional: 2, advisory: 3, open: 4 } as const;
    return chokepointsForZone(zone).sort((a, b) => order[peakSeverity(a)] - order[peakSeverity(b)]);
  }, [zone]);

  if (shown.length === 0) {
    return <div className="empty">No tracked maritime passage in this zone.</div>;
  }

  return (
    <>
      {shown.map((cp) => (
        <Row key={cp.id} cp={cp} report={byId.get(cp.id)} onFocus={onFocus} />
      ))}
    </>
  );
}
