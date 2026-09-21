/**
 * The energy and sanctions reading panel.
 *
 * Three things the map cannot show: the trunk lines that are NOT flowing and why,
 * the regime arithmetic (how many of the world's restriction regimes are actually
 * sectoral rather than a list of names), and the designated-vessel roster — which
 * has no coordinates in any source and is therefore a searchable list keyed on IMO
 * rather than markers scattered across the oceans.
 *
 * The vessel list is fetched on first open rather than with the rest of the
 * channel: 700 records are more bytes than everything else here put together.
 */
import { useEffect, useMemo, useState } from "react";
import { countryName } from "@shared/flags";
import { PIPELINES, pipelineTally } from "@shared/pipeline-registry";
import { STATUS_COLOR, STATUS_LABEL, capacityLabel, isFlowing, routeLabel } from "@shared/pipelines";
import {
  AUTHORITY_LABEL,
  MEASURE_CLASS_BLURB,
  MEASURE_CLASS_COLOR,
  MEASURE_CLASS_LABEL,
  MEASURE_CLASS_ORDER,
  type MeasureClass,
  type SanctionsRegime,
} from "@shared/sanctions";
import type { EnergyPayload, VesselPayload } from "@shared/types";
import { api } from "../api";

type Section = "lines" | "regimes" | "vessels";

const SECTIONS: { id: Section; label: string }[] = [
  { id: "lines", label: "Trunk lines" },
  { id: "regimes", label: "Regimes" },
  { id: "vessels", label: "Vessels" },
];

function LineRows({ onFocus }: { onFocus: (lat: number, lon: number, zoom?: number) => void }) {
  // Stopped lines lead: an operating pipeline is the null result.
  const ordered = useMemo(
    () => [...PIPELINES].sort((a, b) => Number(isFlowing(a.status)) - Number(isFlowing(b.status))),
    [],
  );
  const tally = pipelineTally(PIPELINES);

  return (
    <div className="scroll-y">
      <p className="note">
        {PIPELINES.length} curated trunk lines — {tally.flowing} flowing, {tally.stopped} stopped or
        broken, {tally.planned} planned. Curated because status is the one thing the OpenStreetMap
        pipeline tiles cannot carry: they draw Nord Stream exactly as it was in 2021.
      </p>
      {ordered.map((p) => {
        const mid = p.path[Math.floor(p.path.length / 2)];
        return (
          <button
            type="button"
            className="row"
            key={p.id}
            onClick={() => onFocus(mid[0], mid[1], p.path.length > 12 ? 4 : 5)}
          >
            <div className="row__top">
              <i className="nrg__dot" style={{ background: STATUS_COLOR[p.status] }} aria-hidden="true" />
              <span className="row__title">{p.short}</span>
              <span className="tag tag--grey">{STATUS_LABEL[p.status]}</span>
            </div>
            <span className="row__meta">
              {routeLabel(p)}
              {p.capacity ? ` · ${capacityLabel(p.capacity)}` : ""}
            </span>
            <span className="row__summary">{p.statusNote}</span>
          </button>
        );
      })}
    </div>
  );
}

function RegimeRows({ regimes }: { regimes: SanctionsRegime[] }) {
  const byClass = useMemo(() => {
    const out = new Map<MeasureClass, SanctionsRegime[]>();
    for (const c of MEASURE_CLASS_ORDER) out.set(c, []);
    for (const r of regimes) out.get(r.measureClass)?.push(r);
    return out;
  }, [regimes]);

  if (regimes.length === 0) {
    return <div className="empty">Turn on the Sanctions layer to load the regime list.</div>;
  }

  return (
    <div className="scroll-y">
      <p className="note">
        {regimes.length} regimes. Most of them restrict named persons and companies and nothing else —
        which is why this board never shades a country simply &ldquo;sanctioned&rdquo;.
      </p>
      {MEASURE_CLASS_ORDER.map((measureClass) => {
        const rows = byClass.get(measureClass) ?? [];
        if (rows.length === 0) return null;
        return (
          <div key={measureClass}>
            <div className="nrg__legend" style={{ borderLeftColor: MEASURE_CLASS_COLOR[measureClass] }}>
              <b>{MEASURE_CLASS_LABEL[measureClass]}</b>
              <span className="tag tag--grey">{rows.length}</span>
              <span className="nrg__blurb">{MEASURE_CLASS_BLURB[measureClass]}</span>
            </div>
            {rows.map((r) => (
              <div className="row" key={r.id}>
                <div className="row__top">
                  <span className="row__title">{r.short}</span>
                  {r.energy && <span className="tag tag--orange">energy</span>}
                  <span className="pop__claim" data-confidence={r.confidence}>
                    {r.confidence}
                  </span>
                </div>
                <span className="row__meta">
                  {AUTHORITY_LABEL[r.authority]}
                  {r.targets.length > 0 ? ` · ${r.targets.map(countryName).join(", ")}` : " · thematic"}
                  {r.measureCount ? ` · ${r.measureCount} measures` : ""}
                  {r.suspendedCount ? ` · ${r.suspendedCount} suspended` : ""}
                </span>
                {r.note && <span className="row__summary">{r.note}</span>}
                <a className="nrg__act" href={r.instrumentUrl} target="_blank" rel="noreferrer">
                  {r.instrument}
                </a>
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}

function VesselRows() {
  const [payload, setPayload] = useState<VesselPayload | null>(null);
  const [failed, setFailed] = useState(false);
  const [query, setQuery] = useState("");

  useEffect(() => {
    let cancelled = false;
    api
      .vessels()
      .then((v) => !cancelled && setPayload(v))
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, []);

  const shown = useMemo(() => {
    const all = payload?.vessels ?? [];
    const q = query.trim().toLowerCase();
    if (!q) return all.slice(0, 200);
    return all
      .filter(
        (v) =>
          v.name.toLowerCase().includes(q) ||
          (v.imo ?? "").includes(q) ||
          (v.mmsi ?? "").includes(q) ||
          (v.flag ?? "").toLowerCase().startsWith(q) ||
          (v.flag ? countryName(v.flag).toLowerCase().includes(q) : false),
      )
      .slice(0, 200);
  }, [payload, query]);

  if (failed) return <div className="empty">Designated-vessel lists unavailable.</div>;
  if (!payload) return <div className="empty">Loading designated vessels…</div>;

  return (
    <>
      <div className="nrg__search">
        <input
          type="search"
          className="nrg__input"
          placeholder="Search name, IMO, MMSI or flag"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search designated vessels"
        />
      </div>
      <div className="scroll-y">
        <p className="note">
          {payload.vessels.length} of {payload.total} designated or shadow-fleet vessels, showing{" "}
          {shown.length}. <b>No positions.</b> Neither OFAC nor OpenSanctions publishes one, so this is
          a roster keyed on IMO rather than markers on the map — a plausible-looking coordinate for a
          designated tanker would be the most misleading thing this board could draw. Vessel data via
          OpenSanctions under CC-BY-NC.
        </p>
        {shown.map((v) => (
          <div className="row" key={v.id}>
            <div className="row__top">
              <span className="row__title">{v.name}</span>
              {v.risk.includes("mare.shadow") && <span className="tag tag--orange">shadow fleet</span>}
              {v.flag && (
                <span className="tag tag--grey" title={`Flag: ${countryName(v.flag)}`}>
                  {v.flag}
                </span>
              )}
            </div>
            <span className="row__meta">
              {v.imo ? `IMO ${v.imo}` : "no IMO published"}
              {v.mmsi ? ` · MMSI ${v.mmsi}` : ""}
              {v.vesselType ? ` · ${v.vesselType}` : ""}
              {v.tonnage ? ` · ${v.tonnage.toLocaleString()} GRT` : ""}
            </span>
            <span className="row__summary">
              {v.listedBy} · {v.programs.slice(0, 4).join(", ")}
            </span>
          </div>
        ))}
        {shown.length === 0 && <div className="empty">No vessel matches that.</div>}
      </div>
    </>
  );
}

export default function EnergyPanel({
  energy,
  regimes,
  onFocus,
}: {
  energy: EnergyPayload;
  /** Curated plus live, already merged by the caller. */
  regimes: SanctionsRegime[];
  onFocus: (lat: number, lon: number, zoom?: number) => void;
}) {
  const [section, setSection] = useState<Section>("lines");

  return (
    <>
      <div className="subtabs" role="tablist" aria-label="Energy sections">
        {SECTIONS.map((s) => (
          <button
            key={s.id}
            type="button"
            role="tab"
            className="subtabs__btn"
            aria-selected={section === s.id}
            onClick={() => setSection(s.id)}
          >
            {s.label}
          </button>
        ))}
        {energy.ofacPublished && <span className="subtabs__note mono">SDN {energy.ofacPublished}</span>}
      </div>

      {section === "lines" && <LineRows onFocus={onFocus} />}
      {section === "regimes" && <RegimeRows regimes={regimes} />}
      {section === "vessels" && <VesselRows />}
    </>
  );
}
