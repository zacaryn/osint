/**
 * The key for what is currently painted, and — when exactly two collective-defence
 * groupings are shown — the three-way split between them.
 *
 * That split is on screen rather than in the popups because it is the finding. Two
 * translucent fills cannot say "23 in both, 9 in NATO alone, 4 in the EU alone and
 * every one of those four neutral or non-aligned"; a line of text can.
 */
import { venn } from "@shared/alliance-registry";
import { fullMembers, type Alliance } from "@shared/alliances";
import { countryName } from "@shared/flags";

const CLASS_MARK: Record<Alliance["pactClass"], string> = {
  "collective-defence": "hatched fill",
  "security-partnership": "outline only",
  "economic-bloc": "dotted",
  rhetorical: "label only",
};

function VennLine({ a, b }: { a: Alliance; b: Alliance }) {
  const split = venn(a, b);
  return (
    <div className="allegend__venn">
      <b>{split.both.length}</b> in both · <b>{split.aOnly.length}</b> {a.short} only · <b>{split.bOnly.length}</b>{" "}
      {b.short} only
      {split.bOnly.length > 0 && split.bOnly.length <= 5 && (
        <div className="allegend__list">{split.bOnly.map(countryName).join(", ")}</div>
      )}
    </div>
  );
}

export default function AllianceLegend({ selected }: { selected: Alliance[] }) {
  if (selected.length === 0) return null;
  const defence = selected.filter((a) => a.pactClass === "collective-defence");

  return (
    <div className="allegend" aria-hidden="true">
      {selected.slice(0, 6).map((a) => (
        <div className="allegend__row" key={a.id}>
          <i className="allegend__swatch" style={{ background: a.color }} />
          <b>{a.short}</b>
          <span className="allegend__meta">
            {fullMembers(a).length} · {CLASS_MARK[a.pactClass]}
          </span>
        </div>
      ))}
      {selected.length > 6 && <div className="allegend__meta">+{selected.length - 6} more</div>}
      {defence.length === 2 && <VennLine a={defence[0]} b={defence[1]} />}
    </div>
  );
}
