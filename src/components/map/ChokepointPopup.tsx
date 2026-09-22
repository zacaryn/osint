import type { ReactNode } from "react";
import PopupScrollRoot from "./PopupScrollRoot";
import { AGING } from "@shared/cadence";
import { AUTHORITY_LABEL } from "@shared/infrastructure-authority";
import {
  REGIME_LABEL,
  SCOPE_LABEL,
  SEVERITY_COLOR,
  monthYear,
  restrictedTargets,
  type AccessRestriction,
  type ChokepointStatus,
} from "@shared/chokepoints";
import type { EffectiveStatusMeta } from "@shared/status-overlays";
import type { ChokepointReport, ChokepointTraffic } from "@shared/types";
import Sparkline from "../Sparkline";
import ReactiveStatusBanner from "./ReactiveStatusBanner";
import { timeAgo } from "../../time";

const SHIFT_NOTE: Record<NonNullable<ChokepointTraffic["longRun"]>["shift"], string> = {
  collapsed: "collapsed against",
  down: "below",
  steady: "in line with",
  up: "above",
  surged: "far above",
};

const TREND_NOTE: Record<ChokepointTraffic["trend"], string> = {
  above: "above",
  normal: "in line with",
  below: "below",
  idle: "no transits detected against",
};

function throughputLine(cp: ChokepointStatus): string | null {
  if (!cp.throughput) return null;
  const { value, unit, source, asOf } = cp.throughput;
  const unitLabel = unit === "mmbd" ? "million b/d" : unit;
  return `${value} ${unitLabel} · ${source}, ${asOf.slice(0, 4)}`;
}

function RestrictionRow({ r }: { r: AccessRestriction }) {
  const who = r.targets.includes("*") ? "All flags" : r.targets.join("/");
  return (
    <li className="cpop__restriction" style={{ borderLeftColor: SEVERITY_COLOR[r.severity] }}>
      <div className="cpop__rline">
        <b>{who}</b> {SCOPE_LABEL[r.scope]} — <span className="cpop__sev">{r.severity}</span> by {r.imposedBy}
        {r.since ? ` since ${monthYear(r.since)}` : ""}
        {r.until ? ` · until ${monthYear(r.until)}` : ""}
        {r.layer === "temporary" && <span className="cpop__layer"> temporary</span>}
        {r.layer === "standing" && <span className="cpop__layer cpop__layer--stand"> standing</span>}
      </div>
      <div className="cpop__basis">{r.basis}</div>
      <div className="cpop__note">
        {r.note}
        {r.confidence === "reported" && <span className="cpop__flag"> reported — not independently confirmed</span>}
        {r.sourceUrl && (
          <>
            {" "}
            <a href={r.sourceUrl} target="_blank" rel="noreferrer" className="cpop__src">
              source
            </a>
          </>
        )}
      </div>
    </li>
  );
}

type ChokepointView = ChokepointStatus & { effectiveMeta?: EffectiveStatusMeta };

const SHIFT_COLOR: Record<NonNullable<ChokepointTraffic["longRun"]>["shift"], string> = {
  collapsed: "var(--red)",
  down: "var(--orange)",
  steady: "var(--accent)",
  up: "var(--yellow)",
  surged: "var(--yellow)",
};

function trendColor(trend: ChokepointTraffic["trend"]): string {
  if (trend === "idle" || trend === "below") return "var(--orange)";
  return trend === "above" ? "var(--yellow)" : "var(--accent)";
}

function TrendLine({ ratio, color, children }: { ratio: number; color: string; children: ReactNode }) {
  return (
    <div className="cpop__trend">
      <span className="cpop__ratio mono" style={{ color }}>
        ×{ratio.toFixed(2)}
      </span>
      <span>{children}</span>
    </div>
  );
}

function ShortRunLine({ traffic }: { traffic: ChokepointTraffic }) {
  return (
    <>
      {traffic.recent}/day, {TREND_NOTE[traffic.trend]} its own {AGING.chokepointBaselineDays}-day baseline of{" "}
      {traffic.baseline}
    </>
  );
}

function LongRunLine({ longRun }: { longRun: NonNullable<ChokepointTraffic["longRun"]> }) {
  return (
    <>
      {SHIFT_NOTE[longRun.shift]} its {longRun.from} to {longRun.to} mean of {longRun.reference}/day
    </>
  );
}

/**
 * A passage running at a few percent of normal has a 28-day baseline that is
 * itself already collapsed, so its short-run ratio reads "above" on noise. When
 * the baseline is too small to carry meaning the long-run comparison leads
 * instead, because that is the line that states the actual situation.
 */
function TrafficBlock({ traffic }: { traffic: ChokepointTraffic }) {
  const { longRun } = traffic;
  const leadLongRun = traffic.quality === "low" && longRun != null;
  const color = leadLongRun && longRun ? SHIFT_COLOR[longRun.shift] : trendColor(traffic.trend);

  return (
    <div className="cpop__traffic">
      {leadLongRun && longRun ? (
        <>
          <TrendLine ratio={longRun.ratio} color={color}>
            {traffic.recent}/day, <LongRunLine longRun={longRun} />
          </TrendLine>
          <Sparkline
            values={traffic.spark}
            baseline={longRun.reference}
            color={color}
            label={`${traffic.spark.length} day transit trend`}
          />
          <div className="cpop__longrun" data-shift="steady">
            Its own {AGING.chokepointBaselineDays}-day baseline has already absorbed the drop to {traffic.baseline}/day,
            so the short-run ratio of ×{traffic.ratio.toFixed(2)} is noise.
          </div>
        </>
      ) : (
        <>
          <TrendLine ratio={traffic.ratio} color={color}>
            <ShortRunLine traffic={traffic} />
          </TrendLine>
          <Sparkline
            values={traffic.spark}
            baseline={traffic.baseline}
            color={color}
            label={`${traffic.spark.length} day transit trend`}
          />
          {longRun && longRun.shift !== "steady" && (
            <div className="cpop__longrun" data-shift={longRun.shift}>
              ×{longRun.ratio.toFixed(2)} <LongRunLine longRun={longRun} />
            </div>
          )}
        </>
      )}
      <div className="cpop__meta mono">
        IMF PortWatch · data date {traffic.dataDate} ({traffic.lagDays}d behind)
      </div>
    </div>
  );
}

export default function ChokepointPopup({
  cp,
  report,
}: {
  cp: ChokepointView;
  report?: ChokepointReport;
}) {
  const pips = restrictedTargets(cp);
  const throughput = throughputLine(cp);
  return (
    <PopupScrollRoot scrollKey={`chokepoint-${cp.id}`}>
    <div className="cpop">
      <span className="popup__title">{cp.name}</span>
      <div className="cpop__regime">{REGIME_LABEL[cp.regime]}</div>
      <p className="cpop__baseline">{cp.baseline}</p>
      {throughput && <div className="cpop__meta mono">{throughput}</div>}

      {cp.effectiveMeta && cp.effectiveMeta.overlayIds.length > 0 && (
        <p className="cpop__overlay mono">
          Reviewed overlay{cp.effectiveMeta.overlayIds.length > 1 ? "s" : ""} applied ({cp.effectiveMeta.overlayIds.join(", ")})
          {cp.effectiveMeta.authority ? ` · ${AUTHORITY_LABEL[cp.effectiveMeta.authority]}` : ""}
        </p>
      )}

      {report?.reactive && <ReactiveStatusBanner reactive={report.reactive} />}

      {cp.restrictions.length === 0 ? (
        <div className="cpop__clear">No access restriction on record.</div>
      ) : (
        <ul className="cpop__list">
          {cp.restrictions.map((r) => (
            <RestrictionRow key={r.restrictionId ?? `${r.targets.join()}-${r.scope}-${r.since}`} r={r} />
          ))}
        </ul>
      )}

      {pips.length > 0 && (
        <div className="cpop__targets">
          {pips.map((p) => (
            <span key={p.iso3} className="cpop__pip">
              <i style={{ background: p.color }} />
              {p.iso3}
            </span>
          ))}
        </div>
      )}

      {report?.traffic ? (
        <TrafficBlock traffic={report.traffic} />
      ) : (
        <div className="cpop__meta mono">No transit series — IMF PortWatch has no polygon here.</div>
      )}

      {report && report.headlines.length > 0 && (
        <div className="cpop__news">
          {report.headlines.slice(0, 3).map((h) => (
            <div key={h.url} className="popup__row">
              <a href={h.url} target="_blank" rel="noreferrer">
                {h.title}
              </a>
              <div className="popup__meta">
                {h.source}
                {h.publishedAt ? ` · ${timeAgo(h.publishedAt)}` : ""}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
    </PopupScrollRoot>
  );
}
