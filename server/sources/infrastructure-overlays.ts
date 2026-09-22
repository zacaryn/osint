import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { InfrastructureOverlay, OverlayBundle } from "../../shared/status-overlays.ts";

const here = path.dirname(fileURLToPath(import.meta.url));
const DATA_FILE = path.resolve(here, "../../data/infrastructure-overlays.json");

export function loadInfrastructureOverlays(): OverlayBundle {
  try {
    const raw = fs.readFileSync(DATA_FILE, "utf8");
    const parsed = JSON.parse(raw) as OverlayBundle;
    return {
      updatedAt: parsed.updatedAt ?? new Date().toISOString().slice(0, 10),
      overlays: Array.isArray(parsed.overlays) ? parsed.overlays : [],
    };
  } catch {
    return { updatedAt: new Date().toISOString().slice(0, 10), overlays: [] };
  }
}

export type { InfrastructureOverlay };
