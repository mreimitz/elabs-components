import { chromium } from "playwright";
const [which = "ours", rows = "100000", throttle = "4", step = "120"] = process.argv.slice(2);
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const p = await b.newPage({ viewport: { width: 1400, height: 800 } });
const cdp = await p.context().newCDPSession(p);
await cdp.send("Emulation.setCPUThrottlingRate", { rate: Number(throttle) });
await p.goto(`http://localhost:4173/${which}.html?rows=${rows}`);
await p.waitForSelector(which === "ours" ? "tbody td" : ".ag-cell");
await cdp.send("Profiler.enable");
await cdp.send("Profiler.setSamplingInterval", { interval: 200 });
await cdp.send("Profiler.start");
await p.evaluate(async (step) => {
  const el = [...document.querySelectorAll("div")]
    .filter(
      (d) =>
        d.scrollHeight > d.clientHeight + 100 &&
        ["auto", "scroll"].includes(getComputedStyle(d).overflowY),
    )
    .sort((a, b) => b.scrollHeight - a.scrollHeight)[0];
  for (let i = 0; i < 90; i++) {
    el.scrollTop += step;
    await new Promise((r) => requestAnimationFrame(r));
  }
}, Number(step));
const { profile } = await cdp.send("Profiler.stop");
const self = new Map();
const byId = new Map(profile.nodes.map((n) => [n.id, n]));
const dt = profile.timeDeltas;
const counts = new Map();
profile.samples.forEach((id, i) => counts.set(id, (counts.get(id) || 0) + (dt[i] || 0)));
for (const [id, t] of counts) {
  const n = byId.get(id);
  const cf = n.callFrame;
  const key = `${cf.functionName || "(anon)"} ${cf.url.split("/").pop()}:${cf.lineNumber}`;
  self.set(key, (self.get(key) || 0) + t);
}
const total = [...self.values()].reduce((a, b) => a + b, 0);
console.log("total ms", (total / 1000).toFixed(0));
[...self.entries()]
  .sort((a, b) => b[1] - a[1])
  .slice(0, 30)
  .forEach(([k, v]) => console.log((v / 1000).toFixed(1).padStart(8), k));
await b.close();
