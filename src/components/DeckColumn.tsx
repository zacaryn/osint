import { channelById } from "@shared/cadence";
import type { Tweet } from "@shared/types";
import Freshness from "./Freshness";
import TweetCard from "./TweetCard";
import { timeAgo } from "../time";

export type Pane = {
  key: string;
  name: string;
  handle?: string;
  accent: string;
  avatar?: string;
  tweets: Tweet[];
  cadence?: number;
  state?: string;
  error?: string;
  /** When this column was last pulled from the API. */
  fetchedAt?: string;
  /** Timestamp of its newest post. */
  lastPostTs?: number;
};

type Props = {
  pane: Pane;
  /** Posts that arrived on the most recent refresh. */
  freshCount: number;
  loading: boolean;
};

const deckChannel = channelById("deck");

export default function DeckColumn({ pane, freshCount, loading }: Props) {
  return (
    <section className="column" aria-label={pane.name}>
      <div className="column__head" style={{ borderTopColor: pane.accent }}>
        {pane.avatar ? (
          <img className="column__avatar" src={pane.avatar} alt="" loading="lazy" />
        ) : (
          <span className="column__avatar" />
        )}
        <div className="column__who">
          <span className="column__name">
            {pane.name}
            {pane.state && <span className="tag tag--grey">{pane.state}</span>}
          </span>
          <span className="column__handle">
            {pane.handle
              ? `@${pane.handle}${pane.cadence ? ` · ${pane.cadence}/day` : ""}`
              : "merged chronological"}
          </span>
        </div>
        <span className="column__count mono">{pane.tweets.length}</span>
      </div>

      <div className="column__body">
        {pane.error && (
          <div className="error-text">
            {pane.error}
            {pane.handle && (
              <div>
                <a href={`https://x.com/${pane.handle}`} target="_blank" rel="noreferrer">
                  Open @{pane.handle} on X
                </a>
              </div>
            )}
          </div>
        )}
        {!pane.error && pane.tweets.length === 0 && (
          <div className="empty">{loading ? "Loading posts…" : "No posts yet."}</div>
        )}
        {pane.tweets.map((tweet, i) => (
          <div key={`${pane.key}-${tweet.id}`} className={i < freshCount ? "is-new" : ""}>
            <TweetCard tweet={tweet} />
          </div>
        ))}
        {(pane.tweets.length > 0 || pane.fetchedAt) && (
          <div className="column__foot">
            <Freshness channel={deckChannel} at={pane.fetchedAt} showLabel={false} />
            <span className="mono">
              newest post {pane.lastPostTs ? `${timeAgo(pane.lastPostTs)} old` : "–"}
            </span>
            <span className="mono">{pane.tweets.length} posts</span>
          </div>
        )}
      </div>
    </section>
  );
}
