import { useEffect, useRef, useState } from "react";
import type { GeocodeHit, SourceHealth } from "@shared/types";
import { api } from "../api";
import { utcClock } from "../time";

type Props = {
  health: SourceHealth[];
  loading: boolean;
  onJump: (hit: GeocodeHit) => void;
  onRefresh: () => void;
  onExplain: () => void;
  /** Highlights the cadence button until the panel has been opened once. */
  explainHint: boolean;
};

export default function Header({ health, loading, onJump, onRefresh, onExplain, explainHint }: Props) {
  const [now, setNow] = useState(() => new Date());
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<GeocodeHit[]>([]);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (query.trim().length < 3) {
      setHits([]);
      return;
    }
    const id = setTimeout(() => {
      api
        .geocode(query)
        .then((r) => setHits(r.results))
        .catch(() => setHits([]));
    }, 300);
    return () => clearTimeout(id);
  }, [query]);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) setHits([]);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  const down = health.filter((h) => !h.ok).length;
  const up = health.length - down;

  return (
    <header className="header">
      <div className="brand">
        <h1 className="brand__mark">OSINT Watch</h1>
        <span className="brand__sub">Open sources</span>
      </div>

      <time className="clock mono" dateTime={now.toISOString()}>
        {utcClock(now)}
      </time>

      <div className="search" ref={boxRef}>
        <input
          id="place-search"
          className="search__input"
          type="search"
          value={query}
          placeholder="Jump to place…"
          aria-label="Search for a place on the map"
          onChange={(e) => setQuery(e.target.value)}
        />
        {hits.length > 0 && (
          <div className="search__results">
            {hits.map((hit) => (
              <button
                key={`${hit.lat},${hit.lon}`}
                type="button"
                className="search__hit"
                onClick={() => {
                  onJump(hit);
                  setHits([]);
                  setQuery("");
                }}
              >
                {hit.label}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="header__actions">
        <span
          className={`dot ${down > 0 ? "dot--warn" : ""}`}
          title={`${up} of ${health.length} sources responding`}
        />
        <span className="header__health mono">
          {up}/{health.length || "–"}
        </span>
        <button
          type="button"
          className="iconbtn"
          onClick={onRefresh}
          data-busy={loading}
          aria-label="Refresh all feeds"
          title="Refresh all feeds"
        >
          {loading ? "◴" : "⟳"}
        </button>
        <button
          type="button"
          className="iconbtn"
          onClick={onExplain}
          data-hint={explainHint || undefined}
          aria-label="How this board updates"
          title="How this board updates (?)"
        >
          ?
        </button>
      </div>
    </header>
  );
}
