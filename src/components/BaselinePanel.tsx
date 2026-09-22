import { PRECEDENT_BASELINES, baselinesForZone } from "@shared/precedent-registry";
import { zonesByGroup } from "@shared/zones";
import ScrollPane from "./ScrollPane";

export default function BaselinePanel() {
  return (
    <ScrollPane>
      <p className="note">
        Curated historical baselines damp routine headlines in conflict scores and tripwire ratios. Each entry
        carries its own source and last-verified date; they are not fetched live on this tab.
      </p>
      {zonesByGroup().flatMap(({ group, zones }) =>
        zones.flatMap((zone) => {
          const rows = baselinesForZone(zone.id);
          if (rows.length === 0) return [];
          return [
            <section key={zone.id}>
              <h3 className="zonesec__title">
                {group.label} · {zone.short}
              </h3>
              {rows.map((b) => (
                <div className="row" key={b.id}>
                  <div className="row__top">
                    <span className={`tag tag--${b.confidence === "documented" ? "green" : "yellow"}`}>
                      {b.confidence}
                    </span>
                    <span className="row__title">{b.short}</span>
                  </div>
                  <span className="row__summary">{b.note}</span>
                  <div className="row__meta">
                    <span>{b.source}</span>
                    <span>verified {b.lastVerified}</span>
                  </div>
                </div>
              ))}
            </section>,
          ];
        }),
      )}
      <section>
        <h3 className="zonesec__title">All theatres</h3>
        {PRECEDENT_BASELINES.map((b) => (
          <div className="row" key={`all-${b.id}`}>
            <div className="row__top">
              <span className="row__title">{b.short}</span>
              <span className="tag tag--grey">{b.id}</span>
            </div>
            <span className="row__summary">{b.note}</span>
          </div>
        ))}
      </section>
    </ScrollPane>
  );
}
