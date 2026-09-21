/**
 * Civil nuclear power stations, from the WRI Global Power Plant Database.
 *
 * The upstream CSV is 11.4 MB covering every fuel type. It is fetched here,
 * filtered to `primary_fuel=Nuclear`, stripped to the seven fields the popup
 * actually uses and served at roughly 14 kB. The raw file is never forwarded.
 *
 * DATA-QUALITY NOTE carried into the popup rather than hidden: GPPD is a
 * snapshot, not a live register. Its last full refresh predates several
 * shutdowns, so a plant listed here may be permanently closed — Germany's fleet
 * is the obvious case — and `commissioning_year` is blank or approximate for a
 * large minority of rows. Every marker therefore shows the source and a
 * last-verified date instead of being presented as current.
 *
 * CC-BY 4.0: attribution travels with the payload and is rendered on screen.
 */
import { CACHE_MS } from "../../shared/cadence.ts";
import type { NuclearPlant } from "../../shared/types.ts";
import { cached } from "../cache.ts";
import { fetchText } from "../http.ts";

const SOURCE =
  "https://raw.githubusercontent.com/wri/global-power-plant-database/master/output_database/global_power_plant_database.csv";

export const GPPD_ATTRIBUTION = "WRI Global Power Plant Database (CC-BY 4.0)";
export const GPPD_URL = "https://datasets.wri.org/dataset/globalpowerplantdatabase";

/** Below this a "nuclear plant" row is a research reactor or a data error, not a station. */
const MIN_CAPACITY_MW = 5;

/** Quoted fields carry commas in plant names and owner strings, so the split has to respect them. */
function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          field += '"';
          i += 1;
        } else quoted = false;
      } else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") {
      out.push(field);
      field = "";
    } else field += ch;
  }
  out.push(field);
  return out;
}

function columnIndex(header: string[], name: string): number {
  const at = header.indexOf(name);
  if (at < 0) throw new Error(`GPPD: column ${name} missing — upstream schema changed`);
  return at;
}

export async function loadNuclearPlants(): Promise<NuclearPlant[]> {
  return cached("nuclear-plants", CACHE_MS.nuclearPlants, async () => {
    const res = await fetchText(SOURCE, 45000);
    if (!res.ok) throw new Error(`HTTP ${res.status} WRI GPPD`);

    const lines = res.text.split(/\r?\n/);
    const header = splitCsvLine(lines[0] ?? "");
    const at = {
      country: columnIndex(header, "country"),
      name: columnIndex(header, "name"),
      id: columnIndex(header, "gppd_idnr"),
      capacity: columnIndex(header, "capacity_mw"),
      lat: columnIndex(header, "latitude"),
      lon: columnIndex(header, "longitude"),
      fuel: columnIndex(header, "primary_fuel"),
      year: columnIndex(header, "commissioning_year"),
      owner: columnIndex(header, "owner"),
    };

    const out: NuclearPlant[] = [];
    for (let i = 1; i < lines.length; i += 1) {
      const line = lines[i];
      // Cheap prefilter: 34,000 rows would otherwise all be parsed to find 200.
      if (!line || !line.includes("Nuclear")) continue;
      const row = splitCsvLine(line);
      if (row[at.fuel] !== "Nuclear") continue;

      const lat = Number(row[at.lat]);
      const lon = Number(row[at.lon]);
      const capacityMw = Number(row[at.capacity]);
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
      if (!Number.isFinite(capacityMw) || capacityMw < MIN_CAPACITY_MW) continue;

      const year = Number(row[at.year]);
      const owner = row[at.owner]?.trim();
      out.push({
        id: row[at.id] || `${row[at.country]}-${i}`,
        name: row[at.name] || "unnamed",
        country: row[at.country] || "",
        lat: Math.round(lat * 1e4) / 1e4,
        lon: Math.round(lon * 1e4) / 1e4,
        capacityMw: Math.round(capacityMw),
        commissioned: Number.isFinite(year) && year > 1950 ? Math.round(year) : undefined,
        owner: owner || undefined,
      });
    }

    if (out.length === 0) throw new Error("GPPD returned no nuclear rows — upstream filter broke");
    return out.sort((a, b) => b.capacityMw - a.capacityMw);
  });
}
