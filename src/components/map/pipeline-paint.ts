/**
 * How a trunk line is drawn.
 *
 * Status carries the whole signal, so status owns the stroke: only a line moving
 * hydrocarbons is solid. A long dash is a decision, a short dash is emptiness, a
 * dotted line has never been built, and damage gets a second casing stroke
 * underneath so a ruptured line reads at world zoom without a click. Product is
 * width, not colour — three colour axes on one polyline is one too many.
 */
import type { Pipeline, PipelineStatus } from "@shared/pipelines";
import { STATUS_COLOR, isFlowing } from "@shared/pipelines";
import { rgba } from "./paint";

const DASH: Record<PipelineStatus, string | undefined> = {
  operating: undefined,
  reduced: "10 4",
  idle: "3 5",
  suspended: "12 6",
  damaged: "7 4",
  planned: "1 6",
};

export type PipelinePaint = {
  color: string;
  weight: number;
  opacity: number;
  dashArray?: string;
  /** Wider translucent stroke drawn beneath, for lines that need to shout. */
  casing?: { color: string; weight: number; opacity: number };
};

export function pipelinePaint(pipeline: Pipeline): PipelinePaint {
  const color = STATUS_COLOR[pipeline.status];
  // Gas lines outnumber crude lines here, so crude gets the heavier stroke to
  // stay findable rather than to claim importance.
  const weight = pipeline.product === "crude" ? 3 : 2.2;
  const paint: PipelinePaint = {
    color,
    weight,
    opacity: isFlowing(pipeline.status) ? 0.95 : 0.8,
    dashArray: DASH[pipeline.status],
  };
  if (pipeline.status === "damaged" || pipeline.status === "suspended") {
    paint.casing = { color, weight: weight + 5, opacity: 0.18 };
  }
  return paint;
}

/** Wide invisible stroke so a 2 px line is still a touch target. */
export const HIT_WEIGHT = 14;

export function statusTint(status: PipelineStatus, alpha = 0.16): string {
  return rgba(STATUS_COLOR[status], alpha);
}

/** Midpoint of the centreline, for the label anchor. */
export function midpointOf(pipeline: Pipeline): [number, number] {
  const path = pipeline.path;
  return path[Math.floor(path.length / 2)] ?? [0, 0];
}
