import * as esbuild from "esbuild";
import fs from "node:fs";
import path from "node:path";

const out = path.resolve("api/index.js");
fs.mkdirSync(path.dirname(out), { recursive: true });

await esbuild.build({
  entryPoints: ["server/app.ts"],
  outfile: out,
  bundle: true,
  platform: "node",
  target: "node20",
  format: "esm",
  packages: "external",
  logLevel: "info",
});

console.log("Vercel API bundle → api/index.js");
