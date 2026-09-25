import { chromium } from "playwright";
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const p = await b.newPage();
for (const q of ["rows=1000", "rows=1000&page=1"]) {
  await p.goto(`http://localhost:4173/ours.html?${q}`);
  await p.waitForSelector("tbody td");
  const r = await p.evaluate(async () => {
    const el = [...document.querySelectorAll("div")].filter(
      (d) =>
        d.scrollHeight > d.clientHeight + 50 &&
        ["auto", "scroll"].includes(getComputedStyle(d).overflowY),
    )[0];
    if (el) {
      el.scrollTop = 1e9;
      await new Promise((r) => setTimeout(r, 300));
    }
    const ids = [...document.querySelectorAll("tbody tr")]
      .map((t) => t.querySelector("td")?.innerText)
      .filter(Boolean);
    return {
      scrollable: !!el,
      lastId: ids[ids.length - 1],
      pagerText: document.body.innerText.match(/Page \d+ of \d+/)?.[0] ?? null,
      nextBtn: !![...document.querySelectorAll("button")].find((b) => b.innerText === "Next"),
    };
  });
  console.log(q, JSON.stringify(r));
}
await b.close();
