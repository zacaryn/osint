/**
 * Every regime in force against one state, strongest class first.
 *
 * The popup is where the fill stops being a colour and becomes an instrument: a
 * reader who clicks a shaded country gets the class, the issuing authority, the
 * legal act and whether this board traced it or inferred it.
 */
import { countryName } from "@shared/flags";
import {
  AUTHORITY_LABEL,
  MEASURE_CLASS_COLOR,
  MEASURE_CLASS_LABEL,
  regimesAgainst,
  territorialAgainst,
  type SanctionsRegime,
} from "@shared/sanctions";
import PopupScrollRoot from "./PopupScrollRoot";

export default function SanctionsPopup({
  iso3,
  regimes,
}: {
  iso3: string;
  regimes: SanctionsRegime[];
}) {
  const against = regimesAgainst(regimes, iso3);
  const energy = against.filter((r) => r.energy).length;
  const territorial = territorialAgainst(regimes, iso3);

  return (
    <PopupScrollRoot scrollKey={`sanctions-${iso3}`}>
    <div className="pop">
      <div className="pop__head">
        <span className="pop__title">{countryName(iso3)}</span>
        <span className="pop__tag">
          {against.length} regime{against.length === 1 ? "" : "s"}
        </span>
      </div>

      <div className="pop__meta">
        {energy > 0 ? `${energy} restrict hydrocarbons, shipping or terminals` : "none restrict energy"}
      </div>

      <div className="sxlist">
        {against.map((regime) => (
          <div className="sxlist__row" key={regime.id}>
            <div className="sxlist__top">
              <i
                className="sxlist__dot"
                style={{ background: MEASURE_CLASS_COLOR[regime.measureClass] }}
                aria-hidden="true"
              />
              <span className="sxlist__name">{regime.short}</span>
              {regime.energy && <span className="tag tag--orange">energy</span>}
              {regime.territorial && <span className="tag tag--grey">territory only</span>}
            </div>
            <span className="sxlist__class">
              {MEASURE_CLASS_LABEL[regime.measureClass]} · {AUTHORITY_LABEL[regime.authority]}
              {regime.suspendedCount ? ` · ${regime.suspendedCount} suspended` : ""}
            </span>
            {regime.sectors.length > 0 && (
              <span className="sxlist__sectors">{regime.sectors.slice(0, 6).join(" · ")}</span>
            )}
            <div className="sxlist__foot">
              <span className="pop__claim" data-confidence={regime.confidence}>
                {regime.confidence}
              </span>
              <a href={regime.instrumentUrl} target="_blank" rel="noreferrer">
                {regime.live ? "instrument" : regime.instrument}
              </a>
            </div>
          </div>
        ))}
      </div>

      {territorial.length > 0 && (
        <p className="pop__note">
          {territorial.length} of these restrict{territorial.length === 1 ? "s" : ""} territory{" "}
          {countryName(iso3)} does not control, not the state, so {territorial.length === 1 ? "it is" : "they are"}{" "}
          excluded from the fill — a shaded country would say the opposite of what the instrument does.
        </p>
      )}
    </div>
    </PopupScrollRoot>
  );
}
