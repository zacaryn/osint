import { channelById } from "@shared/cadence";
import type { TheaterWatch } from "@shared/types";
import Freshness, { type ChannelStamps } from "./Freshness";

type Props = {
  error: string | null;
  monitors: number;
  stories: number;
  geo: number;
  hotWatches: TheaterWatch[];
  stamps: ChannelStamps;
  flightsOn: boolean;
};

/**
 * The freshness chips tick every second, so they are hidden from assistive tech
 * to keep the live region from announcing the clock; the same figures are read
 * out statically in the "How this updates" panel.
 */
export default function StatusBar({
  error,
  monitors,
  stories,
  geo,
  hotWatches,
  stamps,
  flightsOn,
}: Props) {
  return (
    <div className="status">
      <span className={`dot ${error ? "dot--bad" : ""}`} />
      <span className="status__text" role="status" aria-live="polite">
        {error ? `Degraded: ${error}` : `${monitors} monitors · ${stories} stories · ${geo} geo`}
      </span>

      {hotWatches.length > 0 && (
        <span className="status__hot">▲ {hotWatches.map((w) => w.name).join(" · ")}</span>
      )}

      <span className="status__chans" aria-hidden="true">
        <Freshness channel={channelById("snapshot")} at={stamps.snapshot} />
        <Freshness channel={channelById("deck")} at={stamps.deck} />
        <Freshness channel={channelById("watch")} at={stamps.watch} className="fresh--wide" />
        <Freshness channel={channelById("fronts")} at={stamps.fronts} className="fresh--wide" />
        {flightsOn && <Freshness channel={channelById("flights")} at={stamps.flights} className="fresh--wide" />}
      </span>
    </div>
  );
}
