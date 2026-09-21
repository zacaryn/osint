import { useMemo } from "react";
import { classSpec } from "@shared/strategic-signal-types";
import type { StrategicSignal } from "@shared/types";
import { countryName } from "@shared/flags";

export default function SignalsPanel({
  signals,
  actor,
}: {
  signals: StrategicSignal[];
  actor: string | null;
}) {
  const shown = useMemo(() => {
    const list = actor ? signals.filter((s) => s.iso3 === actor) : signals;
    return list.slice(0, 80);
  }, [signals, actor]);

  const byCountry = useMemo(() => {
    const map = new Map<string, StrategicSignal[]>();
    for (const s of shown) {
      const bucket = map.get(s.iso3) ?? [];
      bucket.push(s);
      map.set(s.iso3, bucket);
    }
    return [...map.entries()].sort((a, b) => b[1].length - a[1].length);
  }, [shown]);

  if (shown.length === 0) {
    return <div className="empty">No strategic signals loaded yet.</div>;
  }

  return (
    <div className="scroll-y">
      <p className="note">
        Slow-burn posture signals persist beyond the 6h breaking window. Curated seeds stay documented; RSS matches
        merge as reported until reviewed.
      </p>
      {byCountry.map(([iso3, rows]) => (
        <section key={iso3}>
          <h3 className="zonesec__title">{countryName(iso3)}</h3>
          {rows.map((s) => {
            const spec = classSpec(s.class);
            return (
              <div className="row" key={s.id}>
                <div className="row__top">
                  <span className={`tag tag--${s.confidence === "documented" ? "green" : "yellow"}`}>
                    {spec.label}
                  </span>
                  <span className="tag tag--grey">{s.origin}</span>
                </div>
                <a className="row__title" href={s.sourceUrl} target="_blank" rel="noreferrer">
                  {s.title}
                </a>
                <span className="row__summary">{s.summary}</span>
                <div className="row__meta">
                  <span>{s.source}</span>
                  <span>{s.observedAt}</span>
                </div>
              </div>
            );
          })}
        </section>
      ))}
    </div>
  );
}
