/**
 * Which groupings are on screen — and, since Phase 3, the only switch the
 * alliance fill has.
 *
 * Twenty overlays at once on a dense world map is illegible, so this is an
 * explicit pick rather than a set of independent toggles, grouped by pact class so
 * the choice itself teaches the distinction. It defaults to NATO + EU because that
 * Venn is the one overlap worth opening this map for.
 *
 * The per-class explanations are the honest part of this control and are not
 * dropped when `showBlurbs` is false — they move to the pact-class reference
 * sheet, because a paragraph under every one of four headers is too much weight
 * for a panel that sits open over the map.
 */
import { ALLIANCES, PACT_CLASS_ORDER } from "@shared/alliance-registry";
import { PACT_CLASS_BLURB, PACT_CLASS_LABEL, memberCount } from "@shared/alliances";

export default function AllianceSelector({
  picks,
  onPicks,
  showBlurbs = true,
}: {
  picks: string[];
  onPicks: (next: string[]) => void;
  showBlurbs?: boolean;
}) {
  const toggle = (id: string) =>
    onPicks(picks.includes(id) ? picks.filter((p) => p !== id) : [...picks, id]);

  return (
    <div className={`alsel ${showBlurbs ? "" : "alsel--tight"}`}>
      {PACT_CLASS_ORDER.map((pactClass) => (
        <div className="alsel__group" key={pactClass}>
          <div className="alsel__legend" data-class={pactClass} title={PACT_CLASS_BLURB[pactClass]}>
            {PACT_CLASS_LABEL[pactClass]}
          </div>
          {showBlurbs && <p className="alsel__blurb">{PACT_CLASS_BLURB[pactClass]}</p>}
          <div className="alsel__grid">
            {ALLIANCES.filter((a) => a.pactClass === pactClass).map((a) => (
              <button
                key={a.id}
                type="button"
                className="chip"
                aria-pressed={picks.includes(a.id)}
                onClick={() => toggle(a.id)}
                title={`${a.name} — ${a.obligation}`}
              >
                <span className="chip__dot" style={{ background: a.color }} />
                {a.short}
                <span className="alsel__count mono">{memberCount(a)}</span>
              </button>
            ))}
          </div>
        </div>
      ))}
      {picks.length > 0 && (
        <button
          type="button"
          className="chip alsel__clear"
          onClick={() => onPicks([])}
          title="Clearing every pick also clears the fill — the picks are the layer"
        >
          Clear all {picks.length}
        </button>
      )}
    </div>
  );
}
