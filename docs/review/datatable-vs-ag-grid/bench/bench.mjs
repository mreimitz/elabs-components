import { chromium } from "playwright";
const BASE = "http://localhost:4173";
const which = process.argv[2];
const rows = Number(process.argv[3] || 10000);
const throttle = Number(process.argv[4] || 1);
const step = Number(process.argv[5] || 120);
const extra = process.argv[6] || "";
const browser = await chromium.launch({
  executablePath: "/opt/pw-browsers/chromium",
  args: ["--enable-precise-memory-info"],
});
const page = await browser.newPage({ viewport: { width: 1400, height: 800 } });
const cellSel = which === "ours" ? "tbody tr td" : ".ag-cell";
const cdp = await page.context().newCDPSession(page);
await cdp.send("Emulation.setCPUThrottlingRate", { rate: throttle });
await page.goto(`${BASE}/${which}.html?rows=${rows}&${extra}`);
await page.waitForSelector(cellSel, { timeout: 120000 });
const mount = await page.evaluate(
  () =>
    new Promise((res) =>
      requestAnimationFrame(() =>
        requestAnimationFrame(() => res(performance.now() - window.__t0)),
      ),
    ),
);
const dom = await page.evaluate(() => document.getElementsByTagName("*").length);
const heap = await page.evaluate(() =>
  performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : null,
);
// first visible text of first data row
const firstText = async () =>
  page.evaluate((w) => {
    if (w === "ours") {
      const tr = [...document.querySelectorAll("tbody tr")].find(
        (t) => t.querySelectorAll("td").length > 5,
      );
      return tr ? tr.innerText.slice(0, 40) : "";
    }
    const c = [...document.querySelectorAll(".ag-center-cols-viewport .ag-row, .ag-row")].sort(
      (a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top,
    )[0];
    return c ? c.innerText.slice(0, 40) : "";
  }, which);
async function timeUntilChange(action) {
  const before = await firstText();
  const t = await page.evaluate(() => performance.now());
  await action();
  await page.waitForFunction(
    ({ w, before }) => {
      let txt;
      if (w === "ours") {
        const tr = [...document.querySelectorAll("tbody tr")].find(
          (t) => t.querySelectorAll("td").length > 5,
        );
        txt = tr ? tr.innerText.slice(0, 40) : "";
      } else {
        const c = [...document.querySelectorAll(".ag-row")].sort(
          (a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top,
        )[0];
        txt = c ? c.innerText.slice(0, 40) : "";
      }
      return txt !== before;
    },
    { w: which, before },
    { timeout: 120000, polling: "raf" },
  );
  return page.evaluate(
    (t) => new Promise((res) => requestAnimationFrame(() => res(performance.now() - t))),
    t,
  );
}
// sort on m3 (click header)
const clickHeader = async (name) => {
  if (which === "ours")
    await page
      .locator("thead button", { hasText: new RegExp(`^${name}$`) })
      .first()
      .click();
  else await page.locator(`.ag-header-cell[col-id="${name}"] .ag-header-cell-label`).click();
};
const sortAsc = await timeUntilChange(() => clickHeader("m3"));
const sortDesc = await timeUntilChange(() => clickHeader("m3"));
const filter = await timeUntilChange(() => page.evaluate(() => window.__setQ("kilo lima")));
const clear = await timeUntilChange(() => page.evaluate(() => window.__setQ("")));
// scroll test: scroll the body by 120px per frame for 180 frames, record frame times
const scroll = await page.evaluate(
  async ({ w, step }) => {
    const el = [...document.querySelectorAll("div")]
      .filter(
        (d) =>
          d.scrollHeight > d.clientHeight + 100 &&
          ["auto", "scroll"].includes(getComputedStyle(d).overflowY),
      )
      .sort((a, b) => b.scrollHeight - a.scrollHeight)[0];
    if (!el) return null;
    const times = [];
    let last = performance.now();
    let blanks = 0;
    for (let i = 0; i < 180; i++) {
      el.scrollTop += step;
      await new Promise((r) => requestAnimationFrame(r));
      const now = performance.now();
      times.push(now - last);
      last = now;
      // blank check: is there a rendered row at viewport middle?
      const rect = el.getBoundingClientRect();
      const hit = document.elementFromPoint(rect.left + 200, rect.top + rect.height / 2);
      if (!hit || !(hit.closest("td") || hit.closest(".ag-cell"))) blanks++;
    }
    times.sort((a, b) => a - b);
    const avg = times.reduce((a, b) => a + b, 0) / times.length;
    return {
      avgFrameMs: +avg.toFixed(1),
      p95FrameMs: +times[Math.floor(times.length * 0.95)].toFixed(1),
      longFrames: times.filter((t) => t > 34).length,
      blankFrames: blanks,
      scrollTop: el.scrollTop,
    };
  },
  { w: which, step },
);
console.log(
  JSON.stringify({
    which,
    rows,
    throttle,
    step,
    extra,
    mountMs: Math.round(mount),
    domNodes: dom,
    heapMB: heap,
    sortAscMs: Math.round(sortAsc),
    sortDescMs: Math.round(sortDesc),
    filterMs: Math.round(filter),
    clearFilterMs: Math.round(clear),
    scroll,
  }),
);
await browser.close();
