import { useMemo, useState } from "react";
import { AGING } from "@shared/cadence";
import type { NewsItem } from "@shared/types";
import { timeAgo } from "../time";

type Props = {
  label: string;
  items: NewsItem[];
  tone?: "default" | "alert";
  /** Seconds per item; the track duration scales with content length. */
  pace?: number;
};

/**
 * The track holds two identical runs and animates to exactly -50%, so the loop
 * is seamless only while both runs measure the same: the gap and the lead-in
 * padding therefore live on the runs and the viewport, never on the track.
 *
 * It is hidden from assistive tech because the same stories are listed in the
 * Intel panel. Pointer hover and the pause button both stop it.
 */
export default function Marquee({ label, items, tone = "default", pace = 6 }: Props) {
  const [paused, setPaused] = useState(false);

  const visible = useMemo(() => items.slice(0, AGING.marqueeItems), [items]);

  // Rounded to 10s steps: a refresh that changes the item count would otherwise
  // retime the running animation and jump the track.
  const duration = Math.max(40, Math.round((visible.length * pace) / 10) * 10);

  if (visible.length === 0) {
    return (
      <div className={`marquee ${tone === "alert" ? "marquee--alert" : ""}`}>
        <span className="marquee__label">{label}</span>
        <div className="marquee__viewport">
          <span className="marquee__empty">Monitoring…</span>
        </div>
      </div>
    );
  }

  const renderRun = (runKey: string) => (
    <div className="marquee__run" key={runKey}>
      {visible.map((item) => (
        <a
          key={`${runKey}-${item.id}`}
          className="marquee__item"
          href={item.url}
          target="_blank"
          rel="noreferrer"
          tabIndex={-1}
        >
          <span className="marquee__src">{item.source}</span>
          <span>{item.title}</span>
          <span className="marquee__time">{timeAgo(item.publishedAt)}</span>
        </a>
      ))}
    </div>
  );

  return (
    <div className={`marquee ${tone === "alert" ? "marquee--alert" : ""} ${paused ? "is-paused" : ""}`}>
      <button
        type="button"
        className="marquee__label"
        onClick={() => setPaused((p) => !p)}
        aria-pressed={paused}
        title={paused ? `Resume ${label} ticker` : `Pause ${label} ticker`}
      >
        {paused ? "❚❚" : "▶"} {label}
      </button>
      <div className="marquee__viewport">
        <div
          className="marquee__track"
          style={{ ["--marquee-duration" as string]: `${duration}s` }}
          aria-hidden="true"
        >
          {renderRun("a")}
          {renderRun("b")}
        </div>
      </div>
    </div>
  );
}
