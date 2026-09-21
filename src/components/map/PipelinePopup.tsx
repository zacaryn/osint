/**
 * What a trunk line's popup has to say: status and why, then the route, then the
 * provenance. Status comes first because it is the only thing the vector tiles
 * cannot tell you.
 */
import { countryName, flagColor } from "@shared/flags";
import { STATUS_COLOR, STATUS_LABEL, PRODUCT_LABEL, capacityLabel, type Pipeline } from "@shared/pipelines";
import { transitRole, ROLE_LABEL } from "@shared/pipeline-registry";

const KIND_LABEL = {
  treaty: "treaty / agreement",
  "state-action": "state action",
  "de-facto": "de facto",
} as const;

export default function PipelinePopup({ pipeline }: { pipeline: Pipeline }) {
  const capacity = capacityLabel(pipeline.capacity);
  return (
    <div className="pop">
      <div className="pop__head">
        <span className="pop__title">{pipeline.name}</span>
        <span className="pop__tag" style={{ ["--pop-tag" as string]: STATUS_COLOR[pipeline.status] }}>
          {STATUS_LABEL[pipeline.status]}
        </span>
      </div>

      <div className="pop__meta">
        {PRODUCT_LABEL[pipeline.product]}
        {capacity ? ` · ${capacity}` : ""} · {pipeline.operator}
      </div>

      <p className="pop__note">{pipeline.statusNote}</p>

      <div className="pipe__route">
        {pipeline.transit.map((iso3) => (
          <span className="pipe__hop" key={iso3} title={`${countryName(iso3)} — ${ROLE_LABEL[transitRole(pipeline, iso3)]}`}>
            <i className="pipe__hopdot" style={{ background: flagColor(iso3) }} />
            {iso3}
          </span>
        ))}
      </div>

      <div className="pop__foot">
        <span className="pop__claim" data-confidence={pipeline.confidence}>
          {KIND_LABEL[pipeline.kind]} · {pipeline.confidence}
        </span>
        {pipeline.since && <span className="pop__since">since {pipeline.since}</span>}
      </div>

      <a className="pop__src" href={pipeline.sourceUrl} target="_blank" rel="noreferrer">
        {pipeline.source}
      </a>
      <span className="pop__verified">verified {pipeline.lastVerified}</span>
    </div>
  );
}
