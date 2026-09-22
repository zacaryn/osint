import { CATEGORY_LABELS, FEEDS } from "@shared/feeds";
import { CREDITS_INTRO, CREDIT_SECTIONS } from "@shared/credits";
import Sheet from "./Sheet";

type Props = {
  open: boolean;
  onClose: () => void;
};

function FeedRollup() {
  const byCat = new Map<string, number>();
  for (const f of FEEDS) {
    byCat.set(f.category, (byCat.get(f.category) ?? 0) + 1);
  }
  return (
    <ul className="cad__list credits__rollup">
      {[...byCat.entries()].map(([cat, n]) => (
        <li key={cat}>
          <b>{CATEGORY_LABELS[cat as keyof typeof CATEGORY_LABELS] ?? cat}</b> — {n} feeds
        </li>
      ))}
      <li className="credits__rollup-total">{FEEDS.length} RSS sources in shared/feeds.ts</li>
    </ul>
  );
}

export default function CreditsSheet({ open, onClose }: Props) {
  return (
    <Sheet title="Credits & sources" open={open} onClose={onClose} variant="modal">
      <div className="sheet__group">
        <p className="cad__intro">{CREDITS_INTRO}</p>
      </div>

      {CREDIT_SECTIONS.map((section) => (
        <div className="sheet__group" key={section.id}>
          <div className="sheet__legend">{section.title}</div>
          {section.intro && <p className="cad__line cad__line--dim">{section.intro}</p>}
          {section.id === "news" && <FeedRollup />}
          <ul className="credits__list">
            {section.items.map((item) => (
              <li className="credits__item" key={`${section.id}-${item.name}`}>
                <div className="credits__name">
                  {item.url ? (
                    <a href={item.url} target="_blank" rel="noreferrer">
                      {item.name}
                    </a>
                  ) : (
                    item.name
                  )}
                </div>
                <div className="credits__note">{item.note}</div>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </Sheet>
  );
}
