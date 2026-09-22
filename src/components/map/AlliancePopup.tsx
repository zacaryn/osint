/**
 * What one country is actually bound by.
 *
 * The popup is the place the fill cannot lie: it names every grouping that lists
 * the country, the tier it holds in each, the article that carries the obligation
 * — or states that there is none — and the date this board last checked. A
 * withdrawal is shown here too, because "absent from the fill" and "walked out in
 * 2002" are different facts.
 */
import { MEMBER_TIER_LABEL, PACT_CLASS_LABEL, type Alliance, type MemberTier } from "@shared/alliances";
import { pactsFor } from "@shared/alliance-registry";
import { countryName } from "@shared/flags";
import PopupScrollRoot from "./PopupScrollRoot";

function memberOf(alliance: Alliance, iso3: string) {
  return alliance.members.find((m) => m.iso3 === iso3);
}

function PactRow({ alliance, iso3, tier }: { alliance: Alliance; iso3: string; tier: MemberTier }) {
  const member = memberOf(alliance, iso3);
  const binding = alliance.pactClass === "collective-defence" && tier === "member";

  return (
    <li className="alpop__pact" data-class={alliance.pactClass} data-tier={tier}>
      <div className="alpop__pline">
        <i className="alpop__swatch" style={{ background: alliance.color }} />
        <b>{alliance.short}</b>
        <span className="alpop__tier mono">{MEMBER_TIER_LABEL[tier]}</span>
        {member?.since && <span className="alpop__since mono">{member.since.slice(0, 4)}</span>}
      </div>
      <div className="alpop__class mono">{PACT_CLASS_LABEL[alliance.pactClass]}</div>
      {member?.tierNote && <div className="alpop__note">{member.tierNote}</div>}
      <div className="alpop__oblig">
        {binding ? <b>Obligation: </b> : <b>No defence obligation. </b>}
        {member?.instrument ?? alliance.obligation}
      </div>
      {member?.note && <div className="alpop__note">{member.note}</div>}
    </li>
  );
}

export default function AlliancePopup({ iso3 }: { iso3: string }) {
  const pacts = pactsFor(iso3);
  const current = pacts.filter((p) => p.tier !== "former");
  const former = pacts.filter((p) => p.tier === "former");
  const defence = current.filter((p) => p.alliance.pactClass === "collective-defence" && p.tier === "member");

  return (
    <PopupScrollRoot scrollKey={`alliance-${iso3}`}>
    <div className="alpop">
      <span className="popup__title">{countryName(iso3)}</span>
      <div className="alpop__summary mono">
        {defence.length === 0
          ? "No collective-defence obligation on this board"
          : `${defence.length} collective-defence obligation${defence.length > 1 ? "s" : ""}: ${defence
              .map((p) => p.alliance.short)
              .join(" · ")}`}
      </div>

      {current.length === 0 ? (
        <div className="alpop__empty">This board lists no grouping for {countryName(iso3)}.</div>
      ) : (
        <ul className="alpop__list">
          {current.map((p) => (
            <PactRow key={p.alliance.id} alliance={p.alliance} iso3={iso3} tier={p.tier} />
          ))}
        </ul>
      )}

      {former.length > 0 && (
        <div className="alpop__former">
          <div className="alpop__flabel mono">Withdrawn / excluded</div>
          <ul className="alpop__list">
            {former.map((p) => (
              <PactRow key={p.alliance.id} alliance={p.alliance} iso3={iso3} tier={p.tier} />
            ))}
          </ul>
        </div>
      )}

      <div className="cpop__meta mono">
        Curated rosters · last verified {current[0]?.alliance.lastVerified ?? former[0]?.alliance.lastVerified ?? "—"}
        {current[0] && (
          <>
            {" · "}
            <a href={current[0].alliance.rosterUrl} target="_blank" rel="noreferrer">
              official roster
            </a>
          </>
        )}
      </div>
    </div>
    </PopupScrollRoot>
  );
}
