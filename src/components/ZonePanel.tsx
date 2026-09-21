import { useMemo } from "react";
import { basesForZone } from "@shared/base-registry";
import { AGING, channelById, hoursLabel } from "@shared/cadence";
import { countryName } from "@shared/flags";
import { BRANCH_LABEL, STATUS_LABEL, operatorColor } from "@shared/military-bases";
import { matchesZone, type Zone } from "@shared/zones";
import type { AccountColumn, ChokepointReport, GeoPoint, NewsItem, ReportedEvent, TheaterWatch } from "@shared/types";
import ChokepointList from "./ChokepointList";
import CopyButton, { citation } from "./CopyButton";
import Freshness, { type ChannelStamps } from "./Freshness";
import TweetCard from "./TweetCard";
import WatchList from "./WatchList";
import { timeAgo } from "../time";

type Props = {
  zone: Zone;
  news: NewsItem[];
  watches: TheaterWatch[];
  columns: AccountColumn[];
  points: GeoPoint[];
  events: ReportedEvent[];
  chokepoints: ChokepointReport[];
  onFocus: (lat: number, lon: number, zoom?: number) => void;
  stamps: ChannelStamps;
};

function inBbox(zone: Zone, lat: number, lon: number): boolean {
  const [south, west, north, east] = zone.bbox;
  return lat >= south && lat <= north && lon >= west && lon <= east;
}

/**
 * Everything the panel shows is scoped to one zone: its tripwires, the wire
 * filtered to its keywords, the OSINT accounts tagged to it, and any mapped
 * events inside its box.
 */
export default function ZonePanel({
  zone,
  news,
  watches,
  columns,
  points,
  events,
  chokepoints,
  onFocus,
  stamps,
}: Props) {
  const zoneWatches = useMemo(
    () => watches.filter((w) => zone.watches.includes(w.id)),
    [watches, zone],
  );

  const zoneNews = useMemo(
    () => news.filter((n) => n.zones.includes(zone.id)).slice(0, 60),
    [news, zone],
  );

  // Tagged specialists plus anything the global desks posted about this zone.
  const zonePosts = useMemo(() => {
    const tagged = columns.filter((c) => c.zones.includes(zone.id)).flatMap((c) => c.tweets);
    const globalHits = columns
      .filter((c) => c.zones.length === 0)
      .flatMap((c) => c.tweets)
      .filter((t) => matchesZone(zone, t.text));
    const seen = new Set<string>();
    return [...tagged, ...globalHits]
      .filter((t) => (seen.has(t.id) ? false : (seen.add(t.id), true)))
      .sort((a, b) => b.createdTs - a.createdTs)
      .slice(0, 40);
  }, [columns, zone]);

  const zoneEvents = useMemo(
    () => events.filter((e) => e.zones.includes(zone.id)).slice(0, 20),
    [events, zone],
  );

  const hazards = useMemo(
    () => points.filter((p) => inBbox(zone, p.lat, p.lon)).slice(0, 20),
    [points, zone],
  );

  const zoneBases = useMemo(() => basesForZone(zone), [zone]);

  const accountCount =
    columns.filter((c) => c.zones.includes(zone.id)).length +
    columns.filter((c) => c.zones.length === 0).length;

  return (
    <div className="scroll-y">
      <div className="zonehead" style={{ borderLeftColor: zone.accent }}>
        <h2 className="zonehead__title">{zone.name}</h2>
        <p className="zonehead__meta">
          {accountCount} monitors · {zoneNews.length} stories · {zoneWatches.length} tripwires
        </p>
        <div className="zonehead__fresh">
          <Freshness channel={channelById("snapshot")} at={stamps.snapshot} />
          <Freshness channel={channelById("deck")} at={stamps.deck} />
          <Freshness channel={channelById("watch")} at={stamps.watch} />
          <Freshness channel={channelById("chokepoints")} at={stamps.chokepoints} />
        </div>
      </div>

      <Section title="Tripwires">
        {zoneWatches.length === 0 ? (
          <div className="empty">No tripwire assigned.</div>
        ) : (
          <WatchList
            watches={zoneWatches}
            onFocus={(w) => onFocus(w.center[0], w.center[1], w.zoom)}
            compact
          />
        )}
      </Section>

      <Section title={`Reported events (${zoneEvents.length})`}>
        {zoneEvents.length === 0 ? (
          <div className="empty">
            No geolocated reporting in the last {hoursLabel(AGING.eventWindowMs)}.
          </div>
        ) : (
          zoneEvents.map((e) => (
            <div className="rowwrap" key={e.id}>
              <button type="button" className="row" onClick={() => onFocus(e.lat, e.lon, 7)}>
                <div className="row__top">
                  <span className={`tag tag--${e.conflict >= 20 ? "red" : e.conflict >= 14 ? "orange" : "yellow"}`}>
                    {e.place}
                  </span>
                  <span className="tag tag--grey">{e.source}</span>
                </div>
                <span className="row__title">{e.title}</span>
                <div className="row__meta">
                  <span>{timeAgo(e.publishedAt)}</span>
                </div>
              </button>
              <CopyButton
                className="rowwrap__copy"
                text={e.url}
                altText={citation(e.title, e.source, e.url)}
                what="link to this report"
              />
            </div>
          ))
        )}
      </Section>

      <Section title="Maritime access">
        <ChokepointList zone={zone} reports={chokepoints} onFocus={onFocus} />
      </Section>

      <Section title={`Military installations (${zoneBases.length})`}>
        {zoneBases.length === 0 ? (
          <div className="empty">No installation on the curated roster falls in this zone.</div>
        ) : (
          zoneBases.map((b) => (
            <button
              key={b.id}
              type="button"
              className="row"
              onClick={() => onFocus(b.lat, b.lon, 8)}
            >
              <div className="row__top">
                <i className="actor__dot" style={{ background: operatorColor(b) }} />
                <span className="row__title">{b.name}</span>
                <span className={`tag tag--${b.status === "active" ? "green" : "grey"}`}>{STATUS_LABEL[b.status]}</span>
              </div>
              <span className="row__meta">
                {countryName(b.operator)} · {BRANCH_LABEL[b.branch]} · in {countryName(b.hostCountry)}
              </span>
            </button>
          ))
        )}
      </Section>

      <Section title="Key terrain">
        {zone.keyTerrain.map((c) => (
          <button
            key={c.name}
            type="button"
            className="row"
            onClick={() => onFocus(c.lat, c.lon, 8)}
          >
            <div className="row__top">
              <span className="tag tag--blue">◈</span>
              <span className="row__title">{c.name}</span>
            </div>
            <span className="row__summary">{c.note}</span>
          </button>
        ))}
      </Section>

      <Section title={`OSINT feed (${zonePosts.length})`}>
        {zonePosts.length === 0 ? (
          <div className="empty">No posts from this zone's monitors yet.</div>
        ) : (
          zonePosts.slice(0, 20).map((t) => <TweetCard key={`z-${t.id}`} tweet={t} />)
        )}
      </Section>

      <Section title={`Wire (${zoneNews.length})`}>
        {zoneNews.length === 0 ? (
          <div className="empty">Nothing on the wire for this zone.</div>
        ) : (
          zoneNews.map((n) => (
            <div className="rowwrap" key={n.id}>
              <a className="row" href={n.url} target="_blank" rel="noreferrer">
                <div className="row__top">
                  {n.breaking && <span className="tag tag--live">Breaking</span>}
                  <span className="tag tag--grey">{n.source}</span>
                </div>
                <span className="row__title">{n.title}</span>
                <div className="row__meta">
                  <span>{timeAgo(n.publishedAt)}</span>
                </div>
              </a>
              <CopyButton
                className="rowwrap__copy"
                text={n.url}
                altText={citation(n.title, n.source, n.url)}
                what="link to this story"
              />
            </div>
          ))
        )}
      </Section>

      {hazards.length > 0 && (
        <Section title={`Hazards in area (${hazards.length})`}>
          {hazards.map((p) => (
            <button
              key={p.id}
              type="button"
              className="row"
              onClick={() => onFocus(p.lat, p.lon, 7)}
            >
              <div className="row__top">
                <span className="tag tag--grey">{p.kind}</span>
                <span className="row__title">{p.title}</span>
              </div>
              {p.when && <div className="row__meta">{timeAgo(p.when)}</div>}
            </button>
          ))}
        </Section>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="zonesec">
      <h3 className="zonesec__title">{title}</h3>
      {children}
    </section>
  );
}
