/**
 * Curated trunk lines.
 *
 * Each line is drawn three times: a casing for lines that are stopped or broken, a
 * transparent wide stroke so a 2 px polyline is clickable, and the visible stroke
 * on top. That is the standard Leaflet way to get a hit area on a thin line, and
 * it matters more here than usual because the popup is the only place the status
 * story is told.
 */
import { LayerGroup, Polyline, Popup, Tooltip } from "react-leaflet";
import type { Pipeline } from "@shared/pipelines";
import { STATUS_LABEL } from "@shared/pipelines";
import type { ChokepointHeadline } from "@shared/types";
import PipelinePopup from "./PipelinePopup";
import { HIT_WEIGHT, pipelinePaint } from "./pipeline-paint";

import type { ReactiveAssessment } from "@shared/infrastructure-reactive";

export default function PipelineLayer({
  pipelines,
  headlinesById = new Map<string, ChokepointHeadline[]>(),
  reactiveById = new Map<string, ReactiveAssessment | undefined>(),
}: {
  pipelines: Pipeline[];
  headlinesById?: Map<string, ChokepointHeadline[]>;
  reactiveById?: Map<string, ReactiveAssessment | undefined>;
}) {
  return (
    <LayerGroup>
      {pipelines.map((pipeline) => {
        const paint = pipelinePaint(pipeline);
        return (
          <LayerGroup key={pipeline.id}>
            {paint.casing && (
              <Polyline
                positions={pipeline.path}
                interactive={false}
                pathOptions={{
                  color: paint.casing.color,
                  weight: paint.casing.weight,
                  opacity: paint.casing.opacity,
                  lineCap: "butt",
                }}
              />
            )}
            <Polyline
              positions={pipeline.path}
              pathOptions={{ color: paint.color, weight: HIT_WEIGHT, opacity: 0 }}
            >
              <Tooltip direction="top" opacity={1} className="pipe__tip">
                {pipeline.short} — {STATUS_LABEL[pipeline.status]}
              </Tooltip>
              <Popup maxWidth={340} minWidth={260} autoPanPaddingTopLeft={[10, 64]}>
                <PipelinePopup
                  pipeline={pipeline}
                  headlines={headlinesById.get(pipeline.id)}
                  reactive={reactiveById?.get(pipeline.id)}
                />
              </Popup>
            </Polyline>
            <Polyline
              positions={pipeline.path}
              interactive={false}
              pathOptions={{
                color: paint.color,
                weight: paint.weight,
                opacity: paint.opacity,
                dashArray: paint.dashArray,
                lineCap: "butt",
              }}
            />
          </LayerGroup>
        );
      })}
    </LayerGroup>
  );
}
