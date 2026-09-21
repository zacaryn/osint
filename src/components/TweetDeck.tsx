import { useEffect, useMemo, useRef, useState } from "react";
import { AGING, POLL_MS, everyLabel } from "@shared/cadence";
import { matchesZone, zoneById, type ZoneId } from "@shared/zones";
import type { AccountColumn, Tweet } from "@shared/types";
import DeckColumn, { type Pane } from "./DeckColumn";

type Props = {
  columns: AccountColumn[];
  combined: Tweet[];
  loading: boolean;
  zone: ZoneId | null;
  nextRefreshIn: number;
  /** generatedAt of the deck payload, used for the merged column's freshness. */
  deckAt?: string;
  /** Desktop only: the deck pane is folded to its bar. */
  folded?: boolean;
  onToggleFold?: () => void;
  onRefresh: () => void;
  onManage: () => void;
};

function sameCounts(a: Record<string, number>, b: Record<string, number>): boolean {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const key of keys) if (a[key] !== b[key]) return false;
  return true;
}

export default function TweetDeck({
  columns,
  combined,
  loading,
  zone,
  nextRefreshIn,
  deckAt,
  folded = false,
  onToggleFold,
  onRefresh,
  onManage,
}: Props) {
  const [active, setActive] = useState(0);
  const trackRef = useRef<HTMLDivElement>(null);

  const activeZone = zoneById(zone);

  // Columns arrive pre-sorted by measured cadence. In a zone the tagged
  // specialists lead, but the fast global desks stay on the deck because they
  // break events like a Moscow refinery strike before the regional accounts do.
  const scoped = useMemo(() => {
    if (!zone) return columns;
    const tagged = columns.filter((c) => c.zones.includes(zone));
    const global = columns.filter((c) => c.zones.length === 0);
    return [...tagged, ...global];
  }, [columns, zone]);

  const merged = useMemo(() => {
    if (!zone || !activeZone) return combined;
    const tagged = columns.filter((c) => c.zones.includes(zone)).flatMap((c) => c.tweets);
    // Global accounts contribute only the posts that actually mention the zone.
    const globalHits = columns
      .filter((c) => c.zones.length === 0)
      .flatMap((c) => c.tweets)
      .filter((t) => matchesZone(activeZone, t.text));
    const seen = new Set<string>();
    return [...tagged, ...globalHits]
      .filter((t) => (seen.has(t.id) ? false : (seen.add(t.id), true)))
      .sort((a, b) => b.createdTs - a.createdTs)
      .slice(0, AGING.combinedCap);
  }, [zone, activeZone, combined, columns]);

  const panes: Pane[] = [
    {
      key: "all",
      name: zone ? "Zone monitors" : "All monitors",
      accent: "#37e2a8",
      tweets: merged,
      fetchedAt: deckAt,
      lastPostTs: merged[0]?.createdTs,
    },
    ...scoped.map((c) => ({
      key: c.handle,
      name: c.name,
      handle: c.handle,
      accent: c.accent,
      avatar: c.profile?.avatar,
      tweets: c.tweets,
      cadence: c.cadence,
      state: c.state,
      error: c.error,
      fetchedAt: c.fetchedAt,
      lastPostTs: c.lastPostTs,
    })),
  ];

  // Track the newest post id per pane so refreshes can report what arrived.
  const seenRef = useRef(new Map<string, string>());
  const zoneRef = useRef<ZoneId | null>(zone);
  const [fresh, setFresh] = useState<Record<string, number>>({});

  useEffect(() => {
    // A zone change reshuffles the panes and re-tops the merged column; that is
    // not new reporting, so rebaseline silently instead of flagging it.
    if (zoneRef.current !== zone) {
      zoneRef.current = zone;
      seenRef.current.clear();
      for (const pane of panes) {
        const top = pane.tweets[0]?.id;
        if (top) seenRef.current.set(pane.key, top);
      }
      setFresh((prev) => (Object.keys(prev).length ? {} : prev));
      return;
    }

    const next: Record<string, number> = {};
    for (const pane of panes) {
      const top = pane.tweets[0]?.id;
      const prev = seenRef.current.get(pane.key);
      if (prev && top && prev !== top) {
        const idx = pane.tweets.findIndex((t) => t.id === prev);
        next[pane.key] = idx > 0 ? idx : 1;
      }
      if (top) seenRef.current.set(pane.key, top);
    }
    setFresh((prev) => (sameCounts(prev, next) ? prev : next));
    // Panes are derived from columns, so this is the right dependency.
  }, [columns, combined, zone]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    let frame = 0;
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const width = track.clientWidth || 1;
        setActive(Math.round(track.scrollLeft / width));
      });
    };
    track.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      track.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(frame);
    };
  }, []);

  // A zone change reshuffles the panes, so snap back to the merged view.
  useEffect(() => {
    setActive(0);
    trackRef.current?.scrollTo({ left: 0 });
  }, [zone]);

  const goTo = (index: number) => {
    setActive(index);
    const track = trackRef.current;
    if (track) track.scrollTo({ left: index * track.clientWidth, behavior: "smooth" });
  };

  const refreshTitle = `The deck reloads itself every ${everyLabel(POLL_MS.deck)} — next in ${nextRefreshIn}s. It pauses while this tab is in the background. Click to reload now.`;

  return (
    <div className={`deck ${folded ? "is-folded" : ""}`}>
      <div className="deck__bar">
        <div className="deck__switcher" role="tablist" aria-label="Monitored accounts">
          {panes.map((pane, i) => (
            <button
              key={pane.key}
              type="button"
              role="tab"
              aria-selected={active === i}
              className="deck__tab"
              onClick={() => goTo(i)}
            >
              <span className="deck__accent" style={{ background: pane.accent }} />
              {pane.avatar && <img src={pane.avatar} alt="" loading="lazy" />}
              {pane.name}
              {fresh[pane.key] ? (
                <span className="deck__new" title={`${fresh[pane.key]} new since the last reload`}>
                  {fresh[pane.key]}
                </span>
              ) : null}
            </button>
          ))}
        </div>
        <div className="deck__tools">
          <button
            type="button"
            className="iconbtn"
            onClick={onRefresh}
            title={refreshTitle}
            aria-label={`Reload the deck now. Automatic reload in ${nextRefreshIn} seconds.`}
            data-busy={loading}
          >
            {loading ? "◴ sync" : `⟳ auto ${nextRefreshIn}s`}
          </button>
          <button type="button" className="iconbtn" onClick={onManage} title="Add or remove accounts">
            + Accounts
          </button>
          {onToggleFold && (
            <button
              type="button"
              className="iconbtn desk-only"
              onClick={onToggleFold}
              aria-expanded={!folded}
              aria-controls="deck-track"
              title={folded ? "Unfold the deck" : "Fold the deck to its bar"}
            >
              <span aria-hidden="true">{folded ? "▴" : "▾"}</span>
            </button>
          )}
        </div>
      </div>

      <div className="deck__track" id="deck-track" ref={trackRef}>
        {panes.map((pane) => (
          <DeckColumn
            key={pane.key}
            pane={pane}
            freshCount={fresh[pane.key] ?? 0}
            loading={loading}
          />
        ))}
      </div>
    </div>
  );
}
