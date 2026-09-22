import path from "node:path";

/** Writable data root: project `data/` locally, `/tmp` on Vercel serverless. */
export function dataDir(): string {
  if (process.env.VERCEL) {
    return path.join("/tmp", "osint-watch", "data");
  }
  return path.resolve(process.cwd(), "data");
}
