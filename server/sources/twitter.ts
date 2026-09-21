import { rankScore, type AccountConfig } from "../../shared/accounts.ts";
import { AGING, CACHE_MS } from "../../shared/cadence.ts";
import type { AccountColumn, DeckPayload, MediaItem, Tweet, TweetAuthor } from "../../shared/types.ts";
import { listAccounts } from "../accounts-store.ts";
import { cached } from "../cache.ts";
import { fetchJson } from "../http.ts";
import { pool } from "../pool.ts";

type FxMedia = {
  type?: string;
  url?: string;
  thumbnail_url?: string;
  preview_image_url?: string;
};

type FxUser = {
  name?: string;
  screen_name?: string;
  avatar_url?: string;
  followers?: number;
  description?: string;
  verification?: { verified?: boolean } | string | boolean;
};

type FxStatus = {
  id?: string;
  url?: string;
  text?: string;
  created_at?: string;
  created_timestamp?: number;
  likes?: number;
  replies?: number;
  reposts?: number;
  views?: number;
  possibly_sensitive?: boolean;
  author?: FxUser;
  media?: { photos?: FxMedia[]; videos?: FxMedia[]; all?: FxMedia[] };
  reposted_by?: FxUser;
};

type FxTimeline = {
  code?: number;
  results?: FxStatus[];
};

const BASE = process.env.FXTWITTER_BASE_URL?.trim() || "https://api.fxtwitter.com";

function verified(v: FxUser["verification"]): boolean {
  if (v === true) return true;
  if (typeof v === "string") return v.length > 0;
  if (v && typeof v === "object") return Boolean(v.verified);
  return false;
}

function toAuthor(user?: FxUser): TweetAuthor {
  return {
    name: user?.name ?? user?.screen_name ?? "Unknown",
    handle: user?.screen_name ?? "",
    avatar: user?.avatar_url ?? "",
    followers: user?.followers ?? 0,
    verified: verified(user?.verification),
    description: user?.description,
  };
}

function mediaUrl(item?: FxMedia): string | undefined {
  return item?.url || item?.preview_image_url || item?.thumbnail_url;
}

function toTweet(status: FxStatus): Tweet | null {
  if (!status.id || !status.text) return null;
  const photos = status.media?.photos ?? [];
  const videos = status.media?.videos ?? [];
  const all = status.media?.all ?? [];
  const media = (photos.length || videos.length ? [...photos, ...videos] : all)
    .map((item): MediaItem | null => {
      const url = mediaUrl(item);
      if (!url) return null;
      return {
        type: item.type ?? "photo",
        url,
        poster: item.preview_image_url || item.thumbnail_url,
      };
    })
    .filter((m): m is MediaItem => m !== null);

  const createdTs =
    typeof status.created_timestamp === "number"
      ? status.created_timestamp * (status.created_timestamp < 1e12 ? 1000 : 1)
      : Date.parse(status.created_at ?? "") || Date.now();

  return {
    id: String(status.id),
    url: status.url ?? `https://x.com/${status.author?.screen_name}/status/${status.id}`,
    text: status.text,
    createdAt: new Date(createdTs).toISOString(),
    createdTs,
    likes: status.likes ?? 0,
    replies: status.replies ?? 0,
    reposts: status.reposts ?? 0,
    views: status.views ?? 0,
    sensitive: Boolean(status.possibly_sensitive),
    media,
    author: toAuthor(status.author),
    repostedBy: status.reposted_by?.screen_name,
  };
}

const DAY_MS = 86_400_000;

/** Posts per day across the returned window, so ordering reflects current tempo. */
function cadenceOf(tweets: Tweet[]): number {
  if (tweets.length < 2) return 0;
  const stamps = tweets.map((t) => t.createdTs).sort((a, b) => b - a);
  const span = stamps[0] - stamps[stamps.length - 1];
  if (span <= 0) return tweets.length;
  return Number(((stamps.length / span) * DAY_MS).toFixed(1));
}

async function loadAccount(account: AccountConfig): Promise<AccountColumn> {
  const { handle, name, accent, zones, state, analysis, blurb } = account;
  const fetchedAt = new Date().toISOString();
  const base = { handle, name, accent, zones, state, analysis, blurb, fetchedAt };
  try {
    const { data } = await fetchJson<FxTimeline>(
      `${BASE}/2/profile/${handle}/statuses?count=${AGING.postsPerAccount}`,
      18000,
    );
    const tweets = (data.results ?? []).map(toTweet).filter((t): t is Tweet => t !== null);
    // A repost carries the original poster, so match on handle before falling back.
    const profile =
      tweets.find((t) => t.author.handle.toLowerCase() === handle.toLowerCase())?.author ?? tweets[0]?.author;
    const cadence = cadenceOf(tweets);
    return {
      ...base,
      profile,
      tweets,
      cadence,
      score: rankScore(account, cadence || undefined),
      lastPostTs: tweets[0]?.createdTs ?? 0,
    };
  } catch (err) {
    return {
      ...base,
      tweets: [],
      cadence: 0,
      score: 0,
      lastPostTs: 0,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/** Confirms a handle resolves before it is written to the store. */
export async function probeAccount(handle: string): Promise<{ name: string; cadence: number }> {
  const clean = handle.replace(/^@/, "").trim();
  if (!/^[A-Za-z0-9_]{1,15}$/.test(clean)) throw new Error("Not a valid X handle");
  const { data } = await fetchJson<FxTimeline>(
    `${BASE}/2/profile/${clean}/statuses?count=${AGING.postsPerAccount}`,
    18000,
  );
  const tweets = (data.results ?? []).map(toTweet).filter((t): t is Tweet => t !== null);
  if (tweets.length === 0) throw new Error(`@${clean} returned no posts`);
  const own = tweets.find((t) => t.author.handle.toLowerCase() === clean.toLowerCase());
  return { name: own?.author.name ?? clean, cadence: cadenceOf(tweets) };
}

export async function loadDeck(): Promise<DeckPayload> {
  return cached("tweet-deck", CACHE_MS.deck, async () => {
    const accounts = listAccounts();
    const columns = await pool(accounts, 6, loadAccount);

    // Fastest independent reporters first; dead or erroring columns sink.
    columns.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));

    const combined = columns
      .flatMap((col) => col.tweets)
      .sort((a, b) => b.createdTs - a.createdTs)
      .slice(0, AGING.combinedCap);

    return {
      generatedAt: new Date().toISOString(),
      columns,
      combined,
    };
  });
}
