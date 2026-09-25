import { chromium } from "playwright";
const extra = process.argv[2] ?? "rows=5000&wide=200&cv=1";
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const p = await b.newPage({ viewport: { width: 1400, height: 800 } });
await p.goto(`http://localhost:4173/ours.html?${extra}`);
await p.waitForSelector("tbody td");
const cdp = await p.context().newCDPSession(p);
await cdp.send("Profiler.enable");
await cdp.send("Profiler.setSamplingInterval", { interval: 100 });
await cdp.send("Profiler.start");
await p.evaluate(async () => {
  const t = document.querySelector("table");
  let el = t.parentElement;
  while (el && el.scrollWidth <= el.clientWidth) el = el.parentElement;
  for (let i = 0; i < 90; i++) {
    el.scrollLeft += 150;
    await new Promise((r) => requestAnimationFrame(r));
  }
});
const { profile } = await cdp.send("Profiler.stop");
const byId = new Map(profile.nodes.map((n) => [n.id, n]));
const parent = new Map();
for (const n of profile.nodes) for (const c of n.children ?? []) parent.set(c, n.id);
const self = new Map(),
  incl = new Map();
profile.samples.forEach((id, i) => {
  const t = profile.timeDeltas[i] || 0;
  const n = byId.get(id);
  const k = `${n.callFrame.functionName || "(anon)"}:${n.callFrame.lineNumber}`;
  self.set(k, (self.get(k) || 0) + t);
  const seen = new Set();
  let cur = id;
  while (cur !== undefined) {
    const m = byId.get(cur);
    const kk = `${m.callFrame.functionName || "(anon)"}:${m.callFrame.lineNumber}`;
    if (!seen.has(kk)) {
      incl.set(kk, (incl.get(kk) || 0) + t);
      seen.add(kk);
    }
    cur = parent.get(cur);
  }
});
console.log("SELF");
[...self.entries()]
  .sort((a, b) => b[1] - a[1])
  .slice(0, 20)
  .forEach(([k, v]) => console.log((v / 1000).toFixed(1).padStart(8), k));
console.log("INCLUSIVE");
[...incl.entries()]
  .sort((a, b) => b[1] - a[1])
  .slice(0, 40)
  .forEach(([k, v]) => console.log((v / 1000).toFixed(1).padStart(8), k));
await b.close();
