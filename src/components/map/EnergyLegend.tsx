/**
 * The key for the two Phase 3 fills, next to the alliance legend and built the
 * same way.
 *
 * It exists because both layers encode their most important variable in a
 * treatment rather than a colour: pipeline status in the dash pattern and measure
 * class in the weave. A reader who cannot tell a suspended line from an idle one,
 * or a price cap from a listings-only regime, has the wrong map.
 */
import { STATUS_COLOR, STATUS_LABEL, type Pipeline, type PipelineStatus } from "@shared/pipelines";
import {
  MEASURE_CLASS_COLOR,
  MEASURE_CLASS_LABEL,
  MEASURE_CLASS_ORDER,
  type MeasureClass,
  type SanctionsRegime,
} from "@shared/sanctions";

const DASH_MARK: Record<PipelineStatus, string> = {
  operating: "solid",
  reduced: "long dash",
  idle: "fine dash",
  suspended: "wide dash + halo",
  damaged: "dash + halo",
  planned: "dotted",
};

export default function EnergyLegend({
  pipelines,
  regimes,
}: {
  pipelines: Pipeline[];
  regimes: SanctionsRegime[];
}) {
  const statuses = MEASURE_ORDERED_STATUSES.filter((s) => pipelines.some((p) => p.status === s));
  const classes = MEASURE_CLASS_ORDER.filter((c) => regimes.some((r) => r.measureClass === c));
  if (statuses.length === 0 && classes.length === 0) return null;

  return (
    <div className="nrglegend" aria-hidden="true">
      {statuses.length > 0 && (
        <div className="nrglegend__group">
          <div className="nrglegend__head mono">Pipelines</div>
          {statuses.map((status) => (
            <div className="nrglegend__row" key={status}>
              <i className="nrglegend__line" style={{ background: STATUS_COLOR[status] }} />
              <b>{STATUS_LABEL[status]}</b>
              <span className="nrglegend__meta">
                {pipelines.filter((p) => p.status === status).length} · {DASH_MARK[status]}
              </span>
            </div>
          ))}
        </div>
      )}

      {classes.length > 0 && (
        <div className="nrglegend__group">
          <div className="nrglegend__head mono">Sanctions by measure class</div>
          {classes.map((measureClass: MeasureClass) => (
            <div className="nrglegend__row" key={measureClass}>
              <i className="nrglegend__swatch" style={{ background: MEASURE_CLASS_COLOR[measureClass] }} />
              <b>{MEASURE_CLASS_LABEL[measureClass]}</b>
              <span className="nrglegend__meta">
                {regimes.filter((r) => r.measureClass === measureClass).length}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** Stopped first: the analytically interesting statuses lead. */
const MEASURE_ORDERED_STATUSES: PipelineStatus[] = [
  "damaged",
  "suspended",
  "idle",
  "reduced",
  "operating",
  "planned",
];
