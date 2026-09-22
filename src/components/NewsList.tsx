import { useMemo, useState } from "react";
import { CATEGORY_LABELS, type FeedCategory } from "@shared/feeds";
import type { NewsItem } from "@shared/types";
import CopyButton, { citation } from "./CopyButton";
import ScrollPane from "./ScrollPane";
import { timeAgo } from "../time";

type Filter = "all" | FeedCategory;

const FILTERS: Filter[] = ["all", "wire", "gov", "osint", "defense", "politics", "regional"];

export default function NewsList({ news }: { news: NewsItem[] }) {
  const [filter, setFilter] = useState<Filter>("all");

  const counts = useMemo(() => {
    const map = new Map<Filter, number>([["all", news.length]]);
    for (const item of news) map.set(item.category, (map.get(item.category) ?? 0) + 1);
    return map;
  }, [news]);

  const shown = useMemo(
    () => (filter === "all" ? news : news.filter((n) => n.category === filter)).slice(0, 120),
    [news, filter],
  );

  return (
    <>
      <div className="filters" role="group" aria-label="Filter news by source type">
        {FILTERS.map((id) => (
          <button
            key={id}
            type="button"
            className={`chip ${filter === id ? "is-on" : ""}`}
            aria-pressed={filter === id}
            onClick={() => setFilter(id)}
          >
            {id === "all" ? "All" : CATEGORY_LABELS[id]}
            <span className="mono" style={{ opacity: 0.7 }}>
              {counts.get(id) ?? 0}
            </span>
          </button>
        ))}
      </div>
      <ScrollPane>
        {shown.length === 0 && <div className="empty">No stories in this category yet.</div>}
        {shown.map((item) => (
          <div className="rowwrap" key={item.id}>
            <a className="row" href={item.url} target="_blank" rel="noreferrer">
              <div className="row__top">
                {item.breaking && <span className="tag tag--live">Breaking</span>}
                <span className="tag tag--grey">{item.source}</span>
              </div>
              <span className="row__title">{item.title}</span>
              {item.summary && <span className="row__summary">{item.summary}</span>}
              {item.precedent && (
                <span className="row__summary note">{item.precedent.blurb}</span>
              )}
              <div className="row__meta">
                <span>{CATEGORY_LABELS[item.category]}</span>
                <span>{timeAgo(item.publishedAt)}</span>
              </div>
            </a>
            <CopyButton
              className="rowwrap__copy"
              text={item.url}
              altText={citation(item.title, item.source, item.url)}
              what="link to this story"
            />
          </div>
        ))}
      </ScrollPane>
    </>
  );
}
