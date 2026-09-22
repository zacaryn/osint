/**
 * Time-bounded corrections on curated chokepoint and pipeline status.
 *
 * Curated registries hold the slow-moving legal and structural truth. Overlays
 * record what changed this week — a ceasefire window, a partial reopening, a
 * pipeline attack — without rewriting history in git every time the IRGC blinks.
 *
 * Nothing here auto-applies from RSS. Headlines surface in popups; a human (or
 * a reviewed commit to data/infrastructure-overlays.json) promotes a fact to an
 * overlay with authority and dates.
 */
import type { AccessRestriction, ChokepointStatus } from "./chokepoints.ts";
import { AUTHORITY_RANK, type AuthorityTier } from "./infrastructure-authority.ts";
import type { Pipeline, PipelineStatus } from "./pipelines.ts";

export type InfrastructureOverlay = {
  id: string;
  objectiveKind: "chokepoint" | "pipeline";
  objectiveId: string;
  validFrom: string;
  validUntil?: string;
  layer: "standing" | "temporary";
  confidence: "documented" | "reported";
  authority: AuthorityTier;
  source: string;
  sourceUrl?: string;
  note?: string;
  /** Hide curated restrictions with these ids while this overlay is active. */
  pauseRestrictionIds?: string[];
  /** Append a restriction row (must include targets, scope, severity, etc.). */
  restrictionAdd?: AccessRestriction;
  /** Patch fields on an existing curated restriction. */
  restrictionPatch?: Partial<AccessRestriction> & { restrictionId: string };
  pipelineStatus?: PipelineStatus;
  statusNote?: string;
  since?: string;
};

export type OverlayBundle = {
  updatedAt: string;
  overlays: InfrastructureOverlay[];
};

function parseDay(iso: string): number {
  return Date.parse(`${iso.slice(0, 10)}T12:00:00Z`);
}

/** Active on `asOf` (defaults to now). Expired overlays are ignored. */
export function activeOverlays(
  overlays: InfrastructureOverlay[],
  objectiveKind: InfrastructureOverlay["objectiveKind"],
  objectiveId: string,
  asOf = Date.now(),
): InfrastructureOverlay[] {
  return overlays
    .filter((o) => o.objectiveKind === objectiveKind && o.objectiveId === objectiveId)
    .filter((o) => parseDay(o.validFrom) <= asOf)
    .filter((o) => !o.validUntil || parseDay(o.validUntil) >= asOf)
    .sort((a, b) => {
      const rank = AUTHORITY_RANK[b.authority] - AUTHORITY_RANK[a.authority];
      if (rank !== 0) return rank;
      return parseDay(b.validFrom) - parseDay(a.validFrom);
    });
}

function applyRestrictionOverlays(
  base: AccessRestriction[],
  overlays: InfrastructureOverlay[],
): AccessRestriction[] {
  const paused = new Set<string>();
  for (const o of overlays) {
    for (const id of o.pauseRestrictionIds ?? []) paused.add(id);
  }

  let rows = base.filter((r) => !r.restrictionId || !paused.has(r.restrictionId));

  for (const o of overlays) {
    if (o.restrictionPatch?.restrictionId) {
      const idx = rows.findIndex((r) => r.restrictionId === o.restrictionPatch!.restrictionId);
      if (idx >= 0) {
        rows = rows.map((r, i) => (i === idx ? { ...r, ...o.restrictionPatch } : r));
      }
    }
    if (o.restrictionAdd) {
      rows = [...rows, o.restrictionAdd];
    }
  }

  return rows;
}

export type EffectiveStatusMeta = {
  overlayIds: string[];
  /** Highest authority overlay currently shaping this objective. */
  authority?: AuthorityTier;
  reviewedAt?: string;
};

export function mergeChokepointStatus(
  base: ChokepointStatus,
  overlays: InfrastructureOverlay[],
  asOf = Date.now(),
): ChokepointStatus & { effectiveMeta?: EffectiveStatusMeta } {
  const active = activeOverlays(overlays, "chokepoint", base.id, asOf);
  if (active.length === 0) return base;

  const restrictions = applyRestrictionOverlays(base.restrictions, active);
  const top = active[0];

  return {
    ...base,
    restrictions,
    effectiveMeta: {
      overlayIds: active.map((o) => o.id),
      authority: top.authority,
      reviewedAt: top.validFrom,
    },
  };
}

export function mergePipelineStatus(
  base: Pipeline,
  overlays: InfrastructureOverlay[],
  asOf = Date.now(),
): Pipeline & { effectiveMeta?: EffectiveStatusMeta } {
  const active = activeOverlays(overlays, "pipeline", base.id, asOf);
  const top = active.find((o) => o.pipelineStatus || o.statusNote);
  if (!top) return base;

  return {
    ...base,
    status: top.pipelineStatus ?? base.status,
    statusNote: top.statusNote ? `${top.statusNote} (${top.source}, overlay ${top.id})` : base.statusNote,
    since: top.since ?? base.since,
    confidence: top.confidence,
    lastVerified: top.validFrom.slice(0, 10),
    effectiveMeta: {
      overlayIds: active.map((o) => o.id),
      authority: top.authority,
      reviewedAt: top.validFrom,
    },
  };
}
