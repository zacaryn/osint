import * as esbuild from "esbuild";
import fs from "node:fs";
import path from "node:path";

const out = path.resolve("api/index.js");
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

console.log("bundled Vercel API → api/index.js");
