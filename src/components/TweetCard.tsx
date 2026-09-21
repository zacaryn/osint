import { useState } from "react";
import type { Tweet } from "@shared/types";
import CopyButton from "./CopyButton";
import { compact, timeAgo } from "../time";

export default function TweetCard({ tweet }: { tweet: Tweet }) {
  const [revealed, setRevealed] = useState(false);
  const media = tweet.media.slice(0, 4);

  return (
    <article className={`tweet ${tweet.sensitive ? "is-sensitive" : ""} ${revealed ? "is-revealed" : ""}`}>
      <div className="tweet__head">
        {tweet.author.avatar ? (
          <img className="tweet__avatar" src={tweet.author.avatar} alt="" loading="lazy" />
        ) : (
          <span className="tweet__avatar" />
        )}
        <div className="tweet__who">
          <span className="tweet__name">
            {tweet.author.name}
            {tweet.author.verified && (
              <span className="tweet__verified" aria-label="verified">
                ✓
              </span>
            )}
          </span>
          <span className="tweet__handle">@{tweet.author.handle}</span>
        </div>
        <time className="tweet__age" dateTime={tweet.createdAt}>
          {timeAgo(tweet.createdTs)}
        </time>
        <CopyButton
          text={tweet.url}
          altText={`${tweet.text}\n— @${tweet.author.handle}\n${tweet.url}`}
          what="post link"
        />
      </div>

      {tweet.repostedBy && <span className="tweet__rt">↻ reposted by @{tweet.repostedBy}</span>}

      <a className="tweet__text" href={tweet.url} target="_blank" rel="noreferrer">
        {tweet.text}
      </a>

      {media.length > 0 && (
        <div className={`tweet__media ${media.length > 1 ? "tweet__media--multi" : ""}`}>
          {media.map((m) =>
            m.type === "video" || m.type === "gif" ? (
              <video key={m.url} src={m.url} poster={m.poster} controls preload="none" />
            ) : (
              <img key={m.url} src={m.url} alt="" loading="lazy" />
            ),
          )}
          {tweet.sensitive && !revealed && (
            <button type="button" className="tweet__reveal" onClick={() => setRevealed(true)}>
              Sensitive · tap to view
            </button>
          )}
        </div>
      )}

      <div className="tweet__stats" aria-label="engagement">
        <span>↩ {compact(tweet.replies)}</span>
        <span>↻ {compact(tweet.reposts)}</span>
        <span>♥ {compact(tweet.likes)}</span>
        <span>▶ {compact(tweet.views)}</span>
      </div>
    </article>
  );
}
