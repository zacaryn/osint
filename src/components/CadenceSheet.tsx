import { AGING, CHANNELS, channelById, everyLabel, hoursLabel } from "@shared/cadence";
import { SHORTCUTS } from "../shortcuts";
import Freshness, { type ChannelStamps } from "./Freshness";
import Sheet from "./Sheet";

type Props = {
  open: boolean;
  onClose: () => void;
  stamps: ChannelStamps;
};

/**
 * Every number in this panel comes from shared/cadence.ts, which the server
 * pollers and the client timers also read, so the explanation cannot drift.
 */
export default function CadenceSheet({ open, onClose, stamps }: Props) {
  return (
    <Sheet title="How this updates" open={open} onClose={onClose} variant="modal">
      <div className="sheet__group">
        <p className="cad__intro">
          Nothing is pushed to this board. The browser asks the API for each channel on its own timer,
          and the API answers from a short-lived cache — so a figure can be as old as one poll plus one
          cache window. The age shown against each channel is the real one.
        </p>
      </div>

      <div className="sheet__group">
        <div className="sheet__legend">Channels</div>
        {CHANNELS.map((channel) => (
          <div className="cad" key={channel.id}>
            <div className="cad__head">
              <span className="cad__key">{channel.short}</span>
              <span className="cad__name">{channel.label}</span>
              <Freshness channel={channel} at={stamps[channel.id]} showLabel={false} />
            </div>
            <div className="cad__meta mono">
              every {everyLabel(channel.pollMs)} · server cache {everyLabel(channel.cacheMs)}
              {channel.condition ? ` · ${channel.condition.toLowerCase()}` : ""}
            </div>
            <div className="cad__line">{channel.feeds}</div>
            <div className="cad__line cad__line--dim">{channel.ages}</div>
          </div>
        ))}
      </div>

      <div className="sheet__group">
        <div className="sheet__legend">Read tripwires as change, not as level</div>
        <p className="cad__warn">
          A tripwire divides a theater's last {hoursLabel(AGING.watchWindowMs)} of coverage by its own
          daily average over the previous {AGING.watchBaselineDays} days. It measures{" "}
          <b>change against that theater's own normal</b>, so a war running at full intensity for weeks
          becomes its own baseline and settles back toward ×1. A calm tripwire over an active front does
          not mean the fighting stopped — only that coverage is steady. Read the ratio together with the
          headlines listed under it, and treat a quiet theater jumping to ×4 as the actual signal.
        </p>
      </div>

      <div className="sheet__group">
        <div className="sheet__legend">What ages out, and when</div>
        <ul className="cad__list">
          <li>
            The <b>Breaking</b> tag clears {hoursLabel(AGING.breakingWindowMs)} after a story publishes,
            even if the story is still the top item on the wire.
          </li>
          <li>
            Reported-event markers leave the map after {hoursLabel(AGING.eventWindowMs)}, and only stories
            scoring {AGING.eventMinConflict}+ on conflict terms ever earn one.
          </li>
          <li>
            The wire sorts into {Math.round(AGING.newsBucketMs / 60000)}-minute recency buckets and then by
            conflict score, so a strike outranks a same-hour diplomacy item.
          </li>
          <li>
            Each feed contributes only its newest {AGING.perFeedItems} items, capped at{" "}
            {AGING.perCategoryCap} per category; each X account its newest {AGING.postsPerAccount} posts.
          </li>
          <li>Each marquee cycles the {AGING.marqueeItems} most relevant current items.</li>
          <li>
            The deck countdown is its own auto-refresh, every {everyLabel(channelById("deck").pollMs)}; it pauses
            while this tab is in the background and resumes when you come back.
          </li>
        </ul>
      </div>

      <div className="sheet__group">
        <div className="sheet__legend">Keyboard</div>
        <ul className="cad__keys">
          {SHORTCUTS.map((s) => (
            <li key={s.keys}>
              <span className="cad__kbd mono">{s.keys}</span>
              <span>{s.what}</span>
            </li>
          ))}
        </ul>
      </div>
    </Sheet>
  );
}
