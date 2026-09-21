import { everyLabel, staleAfterMs, type ChannelId, type ChannelSpec } from "@shared/cadence";
import { useNow } from "../useNow";

export type ChannelStamps = Partial<Record<ChannelId, string | number | undefined>>;

export function toTs(at?: string | number): number {
  if (at == null) return NaN;
  return typeof at === "number" ? at : Date.parse(at);
}

/** Seconds-accurate for the first minute and a half, then coarser. */
export function ago(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 90) return `${s}s`;
  const m = Math.round(s / 60);
  if (m < 90) return `${m}m`;
  return `${Math.round(m / 60)}h`;
}

export function cadenceTitle(channel: ChannelSpec): string {
  return `${channel.label}: browser polls every ${everyLabel(channel.pollMs)}, the API serves a cached copy for up to ${everyLabel(
    channel.cacheMs,
  )}.`;
}

type Props = {
  channel: ChannelSpec;
  at?: string | number;
  /** Hide the channel key when the surrounding text already names it. */
  showLabel?: boolean;
  className?: string;
};

/** Live "updated Ns ago" for one channel, amber once it is past due. */
export default function Freshness({ channel, at, showLabel = true, className }: Props) {
  const now = useNow();
  const ts = toTs(at);
  const age = Number.isFinite(ts) ? now - ts : NaN;
  const stale = Number.isFinite(age) && age > staleAfterMs(channel);

  return (
    <span
      className={`fresh ${className ?? ""}`}
      data-stale={stale ? "true" : undefined}
      title={cadenceTitle(channel)}
    >
      {showLabel && <span className="fresh__key">{channel.short}</span>}
      <span className="fresh__age mono">{Number.isFinite(age) ? `${ago(age)} ago` : "waiting"}</span>
    </span>
  );
}

/** One-line freshness note for a panel header: what updated, when, how often. */
export function ChannelNote({ channel, at }: { channel: ChannelSpec; at?: string | number }) {
  const now = useNow();
  const ts = toTs(at);
  const age = Number.isFinite(ts) ? now - ts : NaN;
  const stale = Number.isFinite(age) && age > staleAfterMs(channel);

  return (
    <p className="freshnote" data-stale={stale ? "true" : undefined}>
      <span className="freshnote__what">{channel.label}</span>
      <span className="mono">
        {Number.isFinite(age) ? `updated ${ago(age)} ago` : "waiting for first load"} · every{" "}
        {everyLabel(channel.pollMs)}
      </span>
      {stale && <span className="freshnote__late">late</span>}
    </p>
  );
}
