/**
 * How big each designation list is, and when each was last published.
 *
 * The board needs two numbers per authority, not 40 MB of names. The UN list is
 * 2.1 MB and cheap enough to count properly. The EU consolidated file is over
 * 24 MB and the UK OFSI file is 15.9 MB, and downloading 40 MB twice a day to
 * report a row count would be indefensible — so those two are probed with HEAD,
 * which returns `Last-Modified` and `Content-Length`. That yields an honest
 * publication date and a size, and the count is left absent rather than guessed.
 *
 * The EU token in the URL below is a published public constant that appears in
 * the EU's own documentation, not a credential.
 */
import { CACHE_MS } from "../../shared/cadence.ts";
import type { DesignationTally } from "../../shared/types.ts";
import { cached } from "../cache.ts";
import { fetchText } from "../http.ts";

const UN_URL = "https://scsanctions.un.org/resources/xml/en/consolidated.xml";
const EU_URL =
  "https://webgate.ec.europa.eu/fsd/fsf/public/files/xmlFullSanctionsList_1_1/content?token=dG9rZW4tMjAxNw";
const UK_URL = "https://ofsistorage.blob.core.windows.net/publishlive/2022format/ConList.csv";

const UA = "OSINT-Watch/1.0 (local research dashboard)";

async function headSize(url: string): Promise<{ bytes?: number; modified?: string }> {
  const res = await fetch(url, { method: "HEAD", headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const len = res.headers.get("content-length");
  const mod = res.headers.get("last-modified");
  return {
    bytes: len ? Number.parseInt(len, 10) : undefined,
    modified: mod ? new Date(mod).toISOString().slice(0, 10) : undefined,
  };
}

async function unTally(): Promise<DesignationTally> {
  const res = await fetchText(UN_URL, 30000);
  if (!res.ok) throw new Error(`HTTP ${res.status} UN consolidated`);
  const individuals = (res.text.match(/<INDIVIDUAL>/g) ?? []).length;
  const entities = (res.text.match(/<ENTITY>/g) ?? []).length;
  if (individuals + entities === 0) throw new Error("UN list parsed to zero designations");
  return {
    authority: "UN",
    label: "UN Security Council consolidated list",
    publishedAt: /dateGenerated="([^"T]+)/.exec(res.text)?.[1],
    individuals,
    entities,
    total: individuals + entities,
    sourceUrl: UN_URL,
  };
}

async function headTally(
  authority: string,
  label: string,
  url: string,
): Promise<DesignationTally> {
  const { bytes, modified } = await headSize(url);
  return {
    authority,
    label: bytes ? `${label} (${Math.round(bytes / 1024 / 1024)} MB, not counted)` : label,
    publishedAt: modified,
    total: 0,
    sourceUrl: url,
  };
}

export async function loadRosterTallies(): Promise<DesignationTally[]> {
  return cached("roster-tallies", CACHE_MS.sanctionsDigest, async () => {
    const results = await Promise.allSettled([
      unTally(),
      headTally("EU", "EU consolidated financial sanctions list", EU_URL),
      headTally("GB", "UK OFSI consolidated list", UK_URL),
    ]);
    const tallies = results
      .filter((r): r is PromiseFulfilledResult<DesignationTally> => r.status === "fulfilled")
      .map((r) => r.value);
    if (tallies.length === 0) throw new Error("no designation roster reachable");
    return tallies;
  });
}
