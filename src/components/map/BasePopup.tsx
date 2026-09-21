/**
 * Operator, host, branch, source, date — in that order, because that is the order
 * the facts matter in and because presenting any of this as authoritative would be
 * wrong. The probed sources conflated active with closed, returned WWII submarine
 * pens as naval bases, and duplicated Tartus under two navies and two countries.
 * So every popup names its source and when this board last checked it.
 */
import { BRANCH_LABEL, STATUS_LABEL, operatorColor, type MilitaryBase } from "@shared/military-bases";
import { countryName, flagColor } from "@shared/flags";

const STATUS_TONE: Record<MilitaryBase["status"], string> = {
  active: "green",
  "under-construction": "yellow",
  reported: "orange",
  closed: "grey",
};

export default function BasePopup({ base }: { base: MilitaryBase }) {
  const overseas = base.operator !== base.hostCountry;

  return (
    <div className="bpop">
      <span className="popup__title">{base.name}</span>

      <div className="bpop__head">
        <span className={`tag tag--${STATUS_TONE[base.status]}`}>{STATUS_LABEL[base.status]}</span>
        <span className="bpop__branch mono">{BRANCH_LABEL[base.branch]}</span>
      </div>

      <div className="bpop__actors">
        <span className="bpop__actor">
          <i style={{ background: operatorColor(base) }} />
          <span className="bpop__alabel mono">operator</span>
          {countryName(base.operator)}
        </span>
        <span className="bpop__actor">
          <i style={{ background: flagColor(base.hostCountry) }} />
          <span className="bpop__alabel mono">host</span>
          {countryName(base.hostCountry)}
          {!overseas && " (own territory)"}
        </span>
      </div>

      <p className="bpop__role">{base.role}</p>

      {base.hostNote && <div className="bpop__hostnote">{base.hostNote}</div>}

      {base.confidence === "reported" && (
        <div className="cpop__note">
          <span className="cpop__flag">reported — not independently confirmed</span>
        </div>
      )}

      <div className="cpop__meta mono">
        {base.source} ·{" "}
        <a href={base.sourceUrl} target="_blank" rel="noreferrer">
          source
        </a>{" "}
        · curated, last verified {base.lastVerified}
      </div>
    </div>
  );
}
