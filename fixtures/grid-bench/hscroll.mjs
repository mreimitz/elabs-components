// Horizontal scroll budget: node hscroll.mjs <extra query> <throttle>
import { chromium } from "playwright";
const extra = process.argv[2] ?? "";
const which = process.argv[4] ?? "ours";
const throttle = Number(process.argv[3] ?? 4);
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const page = await (await b.newContext({ viewport: { width: 1400, height: 800 } })).newPage();
const t0 = Date.now();
await page.goto(`http://localhost:4173/${which}.html?${extra}`);
await page.waitForSelector(which === "ours" ? "tbody tr td" : ".ag-cell");
const mountMs = Date.now() - t0;
const cdp = await page.context().newCDPSession(page);
await cdp.send("Emulation.setCPUThrottlingRate", { rate: throttle });
const res = await page.evaluate(async () => {
  const t =
    document.querySelector("table") ??
    document.querySelector(".ag-center-cols-viewport") ??
    document.querySelector(".ag-body-horizontal-scroll-viewport");
  let el = t.parentElement ?? t;
  if (!document.querySelector("table"))
    el = document.querySelector(".ag-body-horizontal-scroll-viewport") ?? t;
  else while (el && el.scrollWidth <= el.clientWidth) el = el.parentElement;
  const times = [];
  let last = performance.now();
  for (let i = 0; i < 120; i++) {
    el.scrollLeft += 150;
    await new Promise((r) => requestAnimationFrame(r));
    const now = performance.now();
    times.push(now - last);
    last = now;
  }
  const sorted = [...times].sort((a, b) => a - b);
  return {
    avg: +(times.reduce((a, b) => a + b) / times.length).toFixed(1),
    p95: +sorted[Math.floor(times.length * 0.95)].toFixed(1),
    long: times.filter((x) => x > 34).length,
    domCells: document.querySelectorAll("td, .ag-cell").length,
  };
});
const heap = await page.evaluate(() => performance.memory?.usedJSHeapSize / 1048576);
console.log(JSON.stringify({ which, extra, throttle, mountMs, heapMB: Math.round(heap), ...res }));
await b.close();
