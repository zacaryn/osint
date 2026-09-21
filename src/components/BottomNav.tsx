export type ViewId = "map" | "feed" | "intel";

type Props = {
  view: ViewId;
  onView: (view: ViewId) => void;
  alertCount: number;
};

const ITEMS: { id: ViewId; label: string; glyph: string }[] = [
  { id: "map", label: "Map", glyph: "◈" },
  { id: "feed", label: "Feed", glyph: "▤" },
  { id: "intel", label: "Intel", glyph: "◎" },
];

export default function BottomNav({ view, onView, alertCount }: Props) {
  return (
    <nav className="nav" role="tablist" aria-label="Dashboard views">
      {ITEMS.map((item) => (
        <button
          key={item.id}
          type="button"
          role="tab"
          id={`nav-${item.id}`}
          aria-selected={view === item.id}
          aria-controls={`view-${item.id}`}
          className="nav__btn"
          onClick={() => onView(item.id)}
        >
          <span className="nav__glyph" aria-hidden="true">
            {item.glyph}
          </span>
          {item.label}
          {item.id === "intel" && alertCount > 0 ? (
            <span className="nav__badge" aria-label={`${alertCount} active alerts`}>
              {alertCount > 99 ? "99+" : alertCount}
            </span>
          ) : null}
        </button>
      ))}
    </nav>
  );
}
