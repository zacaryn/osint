/**
 * What a trunk line's popup has to say: status and why, then the route, then the
 * provenance. Status comes first because it is the only thing the vector tiles
 * cannot tell you.
 */
import { countryName, flagColor } from "@shared/flags";
import { AUTHORITY_LABEL } from "@shared/infrastructure-authority";
import { STATUS_COLOR, STATUS_LABEL, PRODUCT_LABEL, capacityLabel, type Pipeline } from "@shared/pipelines";
import { transitRole, ROLE_LABEL } from "@shared/pipeline-registry";
import type { EffectiveStatusMeta } from "@shared/status-overlays";
import type { ChokepointHeadline } from "@shared/types";
import PopupScrollRoot from "./PopupScrollRoot";
import ReactiveStatusBanner from "./ReactiveStatusBanner";
import { timeAgo } from "../../time";
import type { ReactiveAssessment } from "@shared/infrastructure-reactive";

type PipelineView = Pipeline & { effectiveMeta?: EffectiveStatusMeta };

const KIND_LABEL = {
  treaty: "treaty / agreement",
  "state-action": "state action",
  "de-facto": "de facto",
} as const;

export default function PipelinePopup({
  pipeline,
  headlines,
  reactive,
}: {
  pipeline: PipelineView;
  headlines?: ChokepointHeadline[];
  reactive?: ReactiveAssessment;
}) {
  const capacity = capacityLabel(pipeline.capacity);
  const meta = pipeline.effectiveMeta;
  return (
    <PopupScrollRoot scrollKey={`pipeline-${pipeline.id}`}>
    <div className="pop">
      <div className="pop__head">
        <span className="pop__title">{pipeline.name}</span>
        <span className="pop__tag" style={{ ["--pop-tag" as string]: STATUS_COLOR[pipeline.status] }}>
          {STATUS_LABEL[pipeline.status]}
        </span>
      </div>

      {reactive && <ReactiveStatusBanner reactive={reactive} />}

      {meta && meta.overlayIds.length > 0 && (
        <p className="cpop__overlay mono">
          Active status overlay{meta.overlayIds.length > 1 ? "s" : ""} ({meta.overlayIds.join(", ")}) ·{" "}
          {meta.authority ? AUTHORITY_LABEL[meta.authority] : "reviewed"}
          {meta.reviewedAt ? ` · from ${meta.reviewedAt.slice(0, 10)}` : ""}
        </p>
      )}

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

      {headlines && headlines.length > 0 && (
        <div className="cpop__news">
          <div className="cpop__newslabel mono">Recent headlines — review before changing status</div>
          {headlines.slice(0, 4).map((h) => (
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
