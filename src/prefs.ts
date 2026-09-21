import { useEffect, useState, type Dispatch, type SetStateAction } from "react";
import { ALLIANCES } from "@shared/alliance-registry";
import { actorCodes } from "@shared/actors";
import { ZONES, type ZoneId } from "@shared/zones";
import {
  BASEMAPS,
  DEFAULT_LAYERS,
  LAYER_GROUP_IDS,
  type Basemap,
  type LayerGroupId,
  type LayerState,
} from "./components/map/layers";

/**
 * Typed localStorage for UI preferences. Everything is revived through a
 * validator so a stale or hand-edited value can never wedge the board.
 */
export type PrefKey =
  | "zone"
  | "layers"
  | "basemap"
  | "intelTab"
  | "view"
  | "layout"
  | "cadenceSeen"
  | "alliancePicks"
  | "actor"
  | "mapctl";

const NS = "osint-watch";

/** Derived once: the actor list is a join across four static registries. */
const ACTOR_CODES = actorCodes();

function readRaw(key: PrefKey): unknown {
  try {
    const raw = window.localStorage.getItem(`${NS}:${key}`);
    return raw == null ? undefined : JSON.parse(raw);
  } catch {
    return undefined;
  }
}

function writeRaw(key: PrefKey, value: unknown): void {
  try {
    window.localStorage.setItem(`${NS}:${key}`, JSON.stringify(value));
  } catch {
    /* private mode or a full quota: preferences are best-effort */
  }
}

export type Revive<T> = (raw: unknown) => T | null;

export function usePersisted<T>(
  key: PrefKey,
  fallback: T,
  revive: Revive<T>,
): [T, Dispatch<SetStateAction<T>>] {
  const [value, setValue] = useState<T>(() => {
    const raw = readRaw(key);
    if (raw === undefined) return fallback;
    return revive(raw) ?? fallback;
  });

  useEffect(() => {
    writeRaw(key, value);
  }, [key, value]);

  return [value, setValue];
}

export function oneOf<T extends string>(values: readonly T[]): Revive<T> {
  return (raw) => (typeof raw === "string" && (values as readonly string[]).includes(raw) ? (raw as T) : null);
}

export const reviveBool: Revive<boolean> = (raw) => (typeof raw === "boolean" ? raw : null);

export const reviveZone: Revive<ZoneId | null> = (raw) => {
  if (raw === null) return null;
  return typeof raw === "string" && ZONES.some((z) => z.id === raw) ? (raw as ZoneId) : null;
};

export const reviveBasemap = oneOf(BASEMAPS.map((b) => b.id) as Basemap[]);

/** Unknown keys are dropped and missing ones default, so adding a layer is safe. */
export const reviveLayers: Revive<LayerState> = (raw) => {
  if (!raw || typeof raw !== "object") return null;
  const stored = raw as Record<string, unknown>;
  const next = { ...DEFAULT_LAYERS };
  for (const key of Object.keys(DEFAULT_LAYERS) as (keyof LayerState)[]) {
    if (typeof stored[key] === "boolean") next[key] = stored[key] as boolean;
  }
  return next;
};

/** Unknown grouping ids are dropped, so renaming one cannot wedge the map. */
export const reviveAlliancePicks: Revive<string[]> = (raw) => {
  if (!Array.isArray(raw)) return null;
  const known = new Set(ALLIANCES.map((a) => a.id));
  return raw.filter((id): id is string => typeof id === "string" && known.has(id));
};

export const reviveActor: Revive<string | null> = (raw) => {
  if (raw === null) return null;
  return typeof raw === "string" && ACTOR_CODES.includes(raw) ? raw : null;
};

/**
 * State of the map's layer panel: whether it is unfolded at all, and which one
 * group is expanded inside it. One group at a time is the point — the previous
 * control area kept every group open permanently and consumed two thirds of the
 * map.
 */
export type MapCtlState = {
  open: boolean;
  group: LayerGroupId | null;
};

/**
 * Unfolded but with nothing expanded. The group strip is one row and states what
 * is on per group, so the controls stay discoverable; folding it to the single
 * Layers button is the one click that clears the map completely.
 */
export const DEFAULT_MAP_CTL: MapCtlState = { open: true, group: null };

export const reviveMapCtl: Revive<MapCtlState> = (raw) => {
  if (!raw || typeof raw !== "object") return null;
  const stored = raw as Partial<MapCtlState>;
  const group =
    typeof stored.group === "string" && (LAYER_GROUP_IDS as string[]).includes(stored.group)
      ? (stored.group as LayerGroupId)
      : null;
  return { open: typeof stored.open === "boolean" ? stored.open : DEFAULT_MAP_CTL.open, group };
};

export type BoardLayout = {
  intelOpen: boolean;
  deckOpen: boolean;
  intelWidth: number;
  deckHeight: number;
};

export const LAYOUT_LIMITS = {
  intelMin: 260,
  intelMax: 640,
  deckMin: 120,
  deckMax: 760,
} as const;

export const DEFAULT_LAYOUT: BoardLayout = {
  intelOpen: true,
  deckOpen: true,
  intelWidth: 380,
  deckHeight: 320,
};

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export const reviveLayout: Revive<BoardLayout> = (raw) => {
  if (!raw || typeof raw !== "object") return null;
  const stored = raw as Partial<BoardLayout>;
  return {
    intelOpen: typeof stored.intelOpen === "boolean" ? stored.intelOpen : DEFAULT_LAYOUT.intelOpen,
    deckOpen: typeof stored.deckOpen === "boolean" ? stored.deckOpen : DEFAULT_LAYOUT.deckOpen,
    intelWidth: clamp(
      Number(stored.intelWidth) || DEFAULT_LAYOUT.intelWidth,
      LAYOUT_LIMITS.intelMin,
      LAYOUT_LIMITS.intelMax,
    ),
    deckHeight: clamp(
      Number(stored.deckHeight) || DEFAULT_LAYOUT.deckHeight,
      LAYOUT_LIMITS.deckMin,
      LAYOUT_LIMITS.deckMax,
    ),
  };
};
