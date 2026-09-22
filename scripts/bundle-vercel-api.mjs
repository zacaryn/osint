import * as esbuild from "esbuild";
import fs from "node:fs";
import path from "node:path";

const out = path.resolve("dist-server/vercel-api.js");
fs.mkdirSync(path.dirname(out), { recursive: true });

await esbuild.build({
  entryPoints: ["server/vercel-entry.ts"],
  outfile: out,
  bundle: true,
  platform: "node",
  target: "node20",
  format: "esm",
  logLevel: "info",
});

console.log("bundled Vercel API → dist-server/vercel-api.js");
