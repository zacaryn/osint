// Measures which elements overflow a phone viewport, via CDP.
// Usage: node scripts/measure.mjs [width] [url]
import { spawn } from "node:child_process";

const WIDTH = Number(process.argv[2] ?? 390);
const URL_ = process.argv[3] ?? "http://localhost:5173/";
const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const PORT = 9333;

const chrome = spawn(
  CHROME,
  [
    "--headless=new",
    "--disable-gpu",
    `--remote-debugging-port=${PORT}`,
    `--window-size=${WIDTH},800`,
    "--user-data-dir=" + process.env.TEMP + "\\osint-cdp",
    "about:blank",
  ],
  { stdio: "ignore" },
);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function targets() {
  for (let i = 0; i < 40; i += 1) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/json/list`);
      const list = await res.json();
      const page = list.find((t) => t.type === "page");
      if (page) return page;
    } catch {
      /* not up yet */
    }
    await sleep(250);
  }
  throw new Error("Chrome did not expose a debugging target");
}

const page = await targets();
const ws = new WebSocket(page.webSocketDebuggerUrl);
let id = 0;
const pending = new Map();

ws.addEventListener("message", (e) => {
  const msg = JSON.parse(e.data);
  if (msg.id && pending.has(msg.id)) {
    pending.get(msg.id)(msg.result);
    pending.delete(msg.id);
  }
});

await new Promise((r) => ws.addEventListener("open", r));

function send(method, params = {}) {
  id += 1;
  const mid = id;
  return new Promise((resolve) => {
    pending.set(mid, resolve);
    ws.send(JSON.stringify({ id: mid, method, params }));
  });
}

await send("Page.enable");
await send("Page.navigate", { url: URL_ });
await sleep(9000);

const expr = `(() => {
  const vw = document.documentElement.clientWidth;
  const out = { viewport: vw, docScrollWidth: document.documentElement.scrollWidth, bodyScrollWidth: document.body.scrollWidth, offenders: [] };
  document.querySelectorAll('*').forEach((el) => {
    const r = el.getBoundingClientRect();
    if (r.width > vw + 1) {
      out.offenders.push({
        tag: el.tagName.toLowerCase(),
        cls: (el.className && el.className.baseVal !== undefined ? el.className.baseVal : String(el.className || '')).slice(0, 60),
        width: Math.round(r.width),
        right: Math.round(r.right),
        parent: el.parentElement ? (String(el.parentElement.className || el.parentElement.tagName)).slice(0, 40) : ''
      });
    }
  });
  out.offenders = out.offenders.slice(0, 25);
  const nav = document.querySelector('.nav');
  if (nav) out.nav = { width: Math.round(nav.getBoundingClientRect().width), buttons: nav.children.length };
  return JSON.stringify(out, null, 1);
})()`;

const res = await send("Runtime.evaluate", { expression: expr, returnByValue: true });
console.log(res?.result?.value ?? JSON.stringify(res));

ws.close();
chrome.kill();
process.exit(0);
