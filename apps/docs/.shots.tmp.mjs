import { chromium } from "playwright";
const out = process.argv[2];
const re = new RegExp(process.argv[3]);
let idx;
for (let i = 0; i < 60; i++) {
  try {
    idx = await (await fetch("http://localhost:6123/index.json")).json();
    break;
  } catch {
    await new Promise((r) => setTimeout(r, 3000));
  }
}
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1280, height: 900 } });
const ids = Object.keys(idx.entries).filter((k) => re.test(k) && idx.entries[k].type === "story");
console.log(ids.join("\n"));
for (const id of ids)
  for (const theme of ["light", "dark"]) {
    await p.goto(
      `http://localhost:6123/iframe.html?id=${id}&viewMode=story&globals=theme:${theme}`,
      {
        waitUntil: "networkidle",
      },
    );
    await p.waitForTimeout(1500);
    await p.screenshot({ path: `${out}/${id}-${theme}.png`, fullPage: true });
  }
await b.close();
