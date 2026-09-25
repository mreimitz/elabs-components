import { chromium } from "playwright";
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const p = await b.newPage({ viewport: { width: 1400, height: 800 } });
for (const w of ["ours", "ag"]) {
  await p.goto(`http://localhost:4173/${w}.html?rows=1000`);
  await p.waitForSelector(w === "ours" ? "tbody td" : ".ag-cell");
  const role = await p.evaluate((w) => {
    const t =
      w === "ours"
        ? document.querySelector("table")
        : document.querySelector('[role="grid"],[role="treegrid"]');
    return t ? t.getAttribute("role") || t.tagName.toLowerCase() : null;
  }, w);
  // Tab through first 25 tab stops
  await p.mouse.click(5, 5);
  const stops = [];
  for (let i = 0; i < 25; i++) {
    await p.keyboard.press("Tab");
    stops.push(
      await p.evaluate(() => {
        const a = document.activeElement;
        return (
          (a.getAttribute("role") || a.tagName) +
          ":" +
          (a.getAttribute("aria-label") || a.innerText || "").slice(0, 18).replace(/\n/g, " ")
        );
      }),
    );
  }
  // try arrow down from focus on a header
  const before = await p.evaluate(() => document.activeElement.outerHTML.slice(0, 60));
  await p.keyboard.press("ArrowDown");
  await p.keyboard.press("ArrowDown");
  await p.keyboard.press("ArrowRight");
  const after = await p.evaluate(() => {
    const a = document.activeElement;
    return (
      (a.getAttribute("role") || a.tagName) +
      " " +
      (a.getAttribute("aria-colindex") || "") +
      " " +
      (a.innerText || "").slice(0, 20)
    );
  });
  console.log(JSON.stringify({ w, role, first25TabStops: stops.slice(0, 25), afterArrows: after }));
}
await b.close();
