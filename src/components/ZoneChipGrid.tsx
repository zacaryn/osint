import { zonesByGroup, type ZoneId } from "@shared/zones";

type SingleProps = {
  mode: "single";
  selected: ZoneId | null;
  onSelect: (id: ZoneId) => void;
  showAccentDot?: boolean;
};

type MultiProps = {
  mode: "multi";
  selected: ZoneId[];
  onToggle: (id: ZoneId) => void;
};

type Props = (SingleProps | MultiProps) & {
  /** When true, show group legends above each row (map sheet, account manager). */
  showGroupLabels?: boolean;
  showAccentDot?: boolean;
};

export default function ZoneChipGrid(props: Props) {
  const { showGroupLabels = true } = props;
  const grouped = zonesByGroup();

  return (
    <>
      {grouped.map(({ group, zones }) => (
        <div key={group.id} className="zonepick__block">
          {showGroupLabels && <div className="sheet__legend">{group.label}</div>}
          <div className="sheet__grid">
            {zones.map((z) => {
              const pressed =
                props.mode === "single" ? props.selected === z.id : props.selected.includes(z.id);
              const onClick = () =>
                props.mode === "single" ? props.onSelect(z.id) : props.onToggle(z.id);
              return (
                <button
                  key={z.id}
                  type="button"
                  className={`chip${z.group === "passage" ? " chip--passage" : ""}`}
                  aria-pressed={pressed}
                  title={z.blurb}
                  onClick={onClick}
                >
                  {props.mode === "single" && (props.showAccentDot ?? true) && (
                    <span className="chip__dot" style={{ background: z.accent }} />
                  )}
                  {z.short}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </>
  );
}
