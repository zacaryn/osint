import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { DEFAULT_ACCOUNTS, type AccountConfig } from "../shared/accounts.ts";
import type { ZoneId } from "../shared/zones.ts";

const DATA_DIR = path.resolve(process.cwd(), "data");
const FILE = path.join(DATA_DIR, "accounts.json");

type StoreShape = {
  /** Handles added by the user on top of the shipped roster. */
  added: AccountConfig[];
  /** Lower-cased handles from the shipped roster the user switched off. */
  removed: string[];
};

let cache: StoreShape | null = null;

function read(): StoreShape {
  if (cache) return cache;
  try {
    const parsed = JSON.parse(readFileSync(FILE, "utf8")) as Partial<StoreShape>;
    cache = { added: parsed.added ?? [], removed: parsed.removed ?? [] };
  } catch {
    cache = { added: [], removed: [] };
  }
  return cache;
}

function write(next: StoreShape): void {
  cache = next;
  mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(FILE, JSON.stringify(next, null, 2), "utf8");
}

/** Shipped roster minus user removals, plus user additions. */
export function listAccounts(): AccountConfig[] {
  const { added, removed } = read();
  const dropped = new Set(removed.map((h) => h.toLowerCase()));
  const base = DEFAULT_ACCOUNTS.filter((a) => !dropped.has(a.handle.toLowerCase()));
  const seen = new Set(base.map((a) => a.handle.toLowerCase()));
  return [...base, ...added.filter((a) => !seen.has(a.handle.toLowerCase()))];
}

export function isCustom(handle: string): boolean {
  return read().added.some((a) => a.handle.toLowerCase() === handle.toLowerCase());
}

export function addAccount(input: {
  handle: string;
  name: string;
  zones: ZoneId[];
  seedCadence: number;
  blurb?: string;
}): AccountConfig {
  const store = read();
  const handle = input.handle.replace(/^@/, "").trim();
  const exists = listAccounts().some((a) => a.handle.toLowerCase() === handle.toLowerCase());

  // Re-adding a previously removed default should simply restore it.
  const restored = store.removed.filter((h) => h.toLowerCase() !== handle.toLowerCase());
  if (restored.length !== store.removed.length) {
    write({ ...store, removed: restored });
    const original = DEFAULT_ACCOUNTS.find((a) => a.handle.toLowerCase() === handle.toLowerCase());
    if (original) return original;
  }

  if (exists) throw new Error(`@${handle} is already on the deck`);

  const account: AccountConfig = {
    handle,
    name: input.name || handle,
    blurb: input.blurb ?? "User added",
    accent: "#9be7ff",
    zones: input.zones,
    seedCadence: input.seedCadence,
  };
  write({ ...read(), added: [...read().added, account] });
  return account;
}

export function removeAccount(handle: string): void {
  const store = read();
  const lower = handle.toLowerCase();
  const added = store.added.filter((a) => a.handle.toLowerCase() !== lower);
  const wasDefault = DEFAULT_ACCOUNTS.some((a) => a.handle.toLowerCase() === lower);
  write({
    added,
    removed: wasDefault && !store.removed.some((h) => h.toLowerCase() === lower)
      ? [...store.removed, handle]
      : store.removed,
  });
}
