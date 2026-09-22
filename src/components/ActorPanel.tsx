/**
 * One actor, everything this board holds about it.
 *
 * Phase 1 suggested this and alliances are what make it worth having: selecting
 * RUS answers, in one view, which pacts bind it, which passages restrict it, where
 * its forces sit abroad and whose forces sit on its soil. Picking an actor also
 * filters the map, so the panel and the map are asking the same question.
 *
 * The pact list is the point of care: a member of a collective-defence pact, an
 * aspirant to one, a dialogue partner in a trade bloc and a state named in a 2002
 * speech all appear here, and each row states its own class and obligation so they
 * cannot be read as equivalent.
 */
import { useMemo } from "react";
import { actorCodes, actorProfile, flowingCount } from "@shared/actors";
import { MEMBER_TIER_LABEL, PACT_CLASS_LABEL } from "@shared/alliances";
import { SEVERITY_COLOR } from "@shared/chokepoints";
import { countryName } from "@shared/flags";
import { BRANCH_LABEL, STATUS_LABEL, operatorColor, type MilitaryBase } from "@shared/military-bases";
import { ROLE_LABEL } from "@shared/pipeline-registry";
import { classSpec } from "@shared/strategic-signal-types";
import type { StrategicSignal } from "@shared/types";
import { STATUS_COLOR, STATUS_LABEL as PIPE_STATUS_LABEL, capacityLabel, routeLabel } from "@shared/pipelines";
import { AUTHORITY_LABEL, MEASURE_CLASS_COLOR, MEASURE_CLASS_LABEL } from "@shared/sanctions";
import ScrollPane from "./ScrollPane";

const TIER_TONE: Record<string, string> = {
  member: "green",
  suspended: "orange",
  aspirant: "yellow",
  partner: "blue",
  former: "grey",
};

function BaseRow({
  base,
  side,
  onFocus,
}: {
  base: MilitaryBase;
  side: "operates" | "hosts";
  onFocus: (lat: number, lon: number, zoom?: number) => void;
}) {
  return (
    <button type="button" className="row" onClick={() => onFocus(base.lat, base.lon, 7)}>
      <div className="row__top">
        <i className="actor__dot" style={{ background: operatorColor(base) }} />
        <span className="row__title">{base.name}</span>
        <span className={`tag tag--${base.status === "active" ? "green" : "grey"}`}>{STATUS_LABEL[base.status]}</span>
      </div>
      <span className="row__meta">
        {BRANCH_LABEL[base.branch]} ·{" "}
        {side === "operates" ? `in ${countryName(base.hostCountry)}` : `operated by ${countryName(base.operator)}`}
      </span>
    </button>
  );
}

export default function ActorPanel({
  actor,
  onActor,
  onFocus,
  onAlliancePicks,
  signals = [],
}: {
  actor: string | null;
  onActor: (next: string | null) => void;
  onFocus: (lat: number, lon: number, zoom?: number) => void;
  onAlliancePicks: (next: string[]) => void;
  signals?: StrategicSignal[];
}) {
  const actorSignals = useMemo(
    () => (actor ? signals.filter((s) => s.iso3 === actor && s.active) : []),
    [signals, actor],
  );
  const codes = useMemo(actorCodes, []);
  const profile = useMemo(() => (actor ? actorProfile(actor) : null), [actor]);

  return (
    <ScrollPane className="scroll-y actor">
      <div className="actor__pick">
        <label className="actor__label mono" htmlFor="actor-select">
          Actor
        </label>
        <select
          id="actor-select"
          className="actor__select"
          value={actor ?? ""}
          onChange={(e) => onActor(e.target.value || null)}
        >
          <option value="">— all actors —</option>
          {codes.map((code) => (
            <option key={code} value={code}>
              {countryName(code)}
            </option>
          ))}
        </select>
      </div>

      {!profile ? (
        <div className="empty">
          Pick an actor to filter the alliance fills, chokepoint pips and base markers to everything involving it.
        </div>
      ) : (
        <>
          <div className="actor__head">
            <h3 className="actor__name">{profile.name}</h3>
            <p className="actor__meta mono">
              {profile.pacts.length} groupings · {profile.chokepoints.length} passages · {profile.pipelines.length}{" "}
              trunk lines · {profile.sanctions.length} regimes · {profile.operates.length} installations abroad ·{" "}
              {profile.hosts.length} foreign installations hosted
            </p>
            {profile.pacts.length > 0 && (
              <button
                type="button"
                className="chip"
                onClick={() => onAlliancePicks(profile.pacts.map((p) => p.alliance.id))}
              >
                Show all its groupings on the map
              </button>
            )}
          </div>

          <section className="zonesec">
            <h3 className="zonesec__title">Pacts & groupings ({profile.pacts.length})</h3>
            {profile.pacts.length === 0 ? (
              <div className="empty">No grouping on this board names {profile.name}.</div>
            ) : (
              profile.pacts.map(({ alliance, tier, tierNote }) => (
                <div className="row" key={alliance.id}>
                  <div className="row__top">
                    <i className="actor__dot" style={{ background: alliance.color }} />
                    <span className="row__title">{alliance.short}</span>
                    <span className={`tag tag--${TIER_TONE[tier] ?? "grey"}`}>
                      {MEMBER_TIER_LABEL[tier]}
                      {tierNote ? ` · ${tierNote}` : ""}
                    </span>
                  </div>
                  <span className="row__meta">{PACT_CLASS_LABEL[alliance.pactClass]}</span>
                  <span className="row__summary">
                    {alliance.pactClass === "collective-defence" && tier === "member"
                      ? alliance.obligation
                      : `Carries no defence obligation for ${profile.name}. ${alliance.obligation}`}
                  </span>
                </div>
              ))
            )}
          </section>

          <section className="zonesec">
            <h3 className="zonesec__title">Maritime access ({profile.chokepoints.length})</h3>
            {profile.chokepoints.length === 0 ? (
              <div className="empty">No tracked passage names {profile.name}.</div>
            ) : (
              profile.chokepoints.map(({ chokepoint, severity, imposing }) => (
                <button
                  type="button"
                  className="row"
                  key={chokepoint.id}
                  onClick={() => onFocus(chokepoint.lat, chokepoint.lon, 7)}
                >
                  <div className="row__top">
                    <i className="actor__dot" style={{ background: imposing ? "#97a8bc" : SEVERITY_COLOR[severity] }} />
                    <span className="row__title">{chokepoint.name}</span>
                    <span className={`tag tag--${imposing ? "grey" : "orange"}`}>
                      {imposing ? "imposes" : severity}
                    </span>
                  </div>
                </button>
              ))
            )}
          </section>

          <section className="zonesec">
            <h3 className="zonesec__title">Trunk lines ({profile.pipelines.length})</h3>
            {profile.pipelines.length === 0 ? (
              <div className="empty">No tracked pipeline touches {profile.name}.</div>
            ) : (
              <>
                <p className="note">
                  {flowingCount(profile)} of {profile.pipelines.length} flowing. Role is read straight off
                  the transit list, so a state that only has hydrocarbons crossing it is not confused with
                  one that produces them.
                </p>
                {profile.pipelines.map(({ pipeline, role }) => {
                  const mid = pipeline.path[Math.floor(pipeline.path.length / 2)];
                  return (
                    <button
                      type="button"
                      className="row"
                      key={pipeline.id}
                      onClick={() => onFocus(mid[0], mid[1], 4)}
                    >
                      <div className="row__top">
                        <i className="actor__dot" style={{ background: STATUS_COLOR[pipeline.status] }} />
                        <span className="row__title">{pipeline.short}</span>
                        <span className="tag tag--grey">{PIPE_STATUS_LABEL[pipeline.status]}</span>
                      </div>
                      <span className="row__meta">
                        {ROLE_LABEL[role]} · {routeLabel(pipeline)}
                        {pipeline.capacity ? ` · ${capacityLabel(pipeline.capacity)}` : ""}
                      </span>
                    </button>
                  );
                })}
              </>
            )}
          </section>

          <section className="zonesec">
            <h3 className="zonesec__title">Restriction regimes ({profile.sanctions.length})</h3>
            {profile.sanctions.length === 0 ? (
              <div className="empty">
                No curated regime names {profile.name}. The live EU regime list is on the Energy tab.
              </div>
            ) : (
              profile.sanctions.map((regime) => (
                <div className="row" key={regime.id}>
                  <div className="row__top">
                    <i className="actor__dot" style={{ background: MEASURE_CLASS_COLOR[regime.measureClass] }} />
                    <span className="row__title">{regime.short}</span>
                    <span className="tag tag--grey">{MEASURE_CLASS_LABEL[regime.measureClass]}</span>
                  </div>
                  <span className="row__meta">
                    {AUTHORITY_LABEL[regime.authority]}
                    {regime.energy ? " · restricts energy" : ""}
                  </span>
                  <span className="row__summary">{regime.note}</span>
                </div>
              ))
            )}
          </section>

          <section className="zonesec">
            <h3 className="zonesec__title">Installations abroad ({profile.operates.length})</h3>
            {profile.operates.length === 0 ? (
              <div className="empty">No installation abroad on this roster.</div>
            ) : (
              profile.operates.map((b) => <BaseRow key={b.id} base={b} side="operates" onFocus={onFocus} />)
            )}
          </section>

          <section className="zonesec">
            <h3 className="zonesec__title">Foreign installations hosted ({profile.hosts.length})</h3>
            {profile.hosts.length === 0 ? (
              <div className="empty">No foreign installation on this roster.</div>
            ) : (
              profile.hosts.map((b) => <BaseRow key={b.id} base={b} side="hosts" onFocus={onFocus} />)
            )}
          </section>

          <section className="zonesec">
            <h3 className="zonesec__title">Strategic signals ({actorSignals.length})</h3>
            {actorSignals.length === 0 ? (
              <div className="empty">No active strategic signals for this actor.</div>
            ) : (
              actorSignals.slice(0, 8).map((s) => (
                <a key={s.id} className="row" href={s.sourceUrl} target="_blank" rel="noreferrer">
                  <div className="row__top">
                    <span className="tag tag--blue">{classSpec(s.class).label}</span>
                    <span className={`tag tag--${s.confidence === "documented" ? "green" : "yellow"}`}>
                      {s.confidence}
                    </span>
                  </div>
                  <span className="row__title">{s.title}</span>
                  <span className="row__meta">{s.observedAt}</span>
                </a>
              ))
            )}
          </section>
        </>
      )}
    </ScrollPane>
  );
}
