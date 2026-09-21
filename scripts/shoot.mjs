// True mobile-emulated screenshots + overflow report via CDP.
// Usage: node scripts/shoot.mjs <width> <height> <outfile> [url] [clickSelector]
// Several selectors can be chained with ">>" to reach a deeper state.
import { spawn } from "node:child_process";
import { writeFileSync } from "node:fs";

const [, , wArg, hArg, outFile, urlArg, clickSel] = process.argv;
const WIDTH = Number(wArg ?? 390);
const HEIGHT = Number(hArg ?? 844);
const OUT = outFile ?? `${process.env.TEMP}\\osint-shots\\shot.png`;
const URL_ = urlArg ?? "http://localhost:5173/";
const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const PORT = 9334;

const chrome = spawn(
  CHROME,
  [
    "--headless=new",
    "--disable-gpu",
    `--remote-debugging-port=${PORT}`,
    "--window-size=1200,900",
    `--user-data-dir=${process.env.TEMP}\\osint-cdp-shot`,
    "about:blank",
  ],
  { stdio: "ignore" },
);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function target() {
  for (let i = 0; i < 40; i += 1) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
      const page = list.find((t) => t.type === "page");
      if (page) return page;
    } catch {
      /* waiting */
    }
    await sleep(250);
  }
  throw new Error("no debug target");
}

const page = await target();
const ws = new WebSocket(page.webSocketDebuggerUrl);
let id = 0;
const pending = new Map();
ws.addEventListener("message", (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) {
    pending.get(m.id)(m.result);
    pending.delete(m.id);
  }
});
await new Promise((r) => ws.addEventListener("open", r));

const send = (method, params = {}) => {
  id += 1;
  const mid = id;
  return new Promise((resolve) => {
    pending.set(mid, resolve);
    ws.send(JSON.stringify({ id: mid, method, params }));
  });
};

await send("Page.enable");
await send("Emulation.setDeviceMetricsOverride", {
  width: WIDTH,
  height: HEIGHT,
  deviceScaleFactor: 2,
  mobile: WIDTH < 900,
  screenWidth: WIDTH,
  screenHeight: HEIGHT,
});
await send("Emulation.setTouchEmulationEnabled", { enabled: WIDTH < 900, maxTouchPoints: 5 });
await send("Page.navigate", { url: URL_ });
await sleep(10000);

for (const sel of clickSel ? clickSel.split(">>").map((s) => s.trim()) : []) {
  await send("Runtime.evaluate", {
    expression: `document.querySelector(${JSON.stringify(sel)})?.click()`,
  });
  // Map fly-to plus tile loading needs to settle or Leaflet screenshots mid-zoom.
  await sleep(6000);
}

const audit = await send("Runtime.evaluate", {
  returnByValue: true,
  expression: `(() => {
    const vw = document.documentElement.clientWidth;
    const bad = [];
    document.querySelectorAll('*').forEach((el) => {
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      // Ignore anything intentionally clipped by an ancestor.
      let clipped = false;
      for (let p = el.parentElement; p; p = p.parentElement) {
        const pcs = getComputedStyle(p);
        if (pcs.overflowX === 'hidden' || pcs.overflowX === 'auto' || pcs.overflowX === 'scroll') { clipped = true; break; }
      }
      if (!clipped && r.right > vw + 1 && cs.position !== 'fixed') {
        bad.push({ cls: String(el.className || el.tagName).slice(0, 50), w: Math.round(r.width), right: Math.round(r.right) });
      }
    });
    const small = [];
    document.querySelectorAll('button, a.row, a.search__hit, [role=tab]').forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.height > 0 && r.height < 30 && !el.closest('.marquee__track')) {
        small.push({ cls: String(el.className || '').slice(0, 40), h: Math.round(r.height) });
      }
    });
    // Elements that push the document scroll width, ignoring clipped ancestors.
    const raw = [];
    document.querySelectorAll('*').forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.right > vw + 1 && r.width > 0) {
        raw.push({ cls: String(el.className || el.tagName).slice(0, 44), w: Math.round(r.width), right: Math.round(r.right), pos: getComputedStyle(el).position });
      }
    });
    raw.sort((a, b) => b.right - a.right);

    return JSON.stringify({
      viewport: vw,
      docScroll: document.documentElement.scrollWidth,
      overflow: bad.slice(0, 12),
      rawOverflow: raw.slice(0, 8),
      smallTargets: small.slice(0, 12)
    });
  })()`,
});
console.log(audit?.result?.value);

const shot = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
writeFileSync(OUT, Buffer.from(shot.data, "base64"));
console.log("saved", OUT);

ws.close();
chrome.kill();
process.exit(0);
