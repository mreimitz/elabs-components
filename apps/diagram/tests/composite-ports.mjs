/** Real SVG endpoints must meet the named row handles, including after direction changes. */
/* global process, console, document, localStorage, CSS, URL */
import assert from "node:assert/strict";
import { mkdir, writeFile, rm } from "node:fs/promises";
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? "playwright");
const base = process.env.DIAGRAM_URL ?? "http://localhost:5427";
const evidence = process.env.PORT_EVIDENCE;
const folder = `composite-ports-${process.pid}`;
const dir = new URL(`../workspace/${folder}/`, import.meta.url);
const browser = await chromium.launch();
const errors = [],
  results = [];
let page;
try {
  await mkdir(dir, { recursive: true });
  if (evidence) await mkdir(evidence, { recursive: true });
  await writeFile(
    new URL("child.yaml", dir),
    'diagram: "1"\ntitle: Named endpoints\nnodes: [{id: top}, {id: right}]\n',
  );
  for (const direction of ["LR", "TB"]) {
    const text = `diagram: "1"\ntitle: Named port geometry\ndirection: ${direction}\nnodes: [{id: a}, {id: b}, {id: t, ref: ws/${folder}/child}]\nflows: ["a -> t.top", "b -> t.right", "t.top -> b", "t.right -> a"]\n`;
    await writeFile(new URL(`${direction}.yaml`, dir), text);
    for (const theme of ["light", "dark"]) {
      const context = await browser.newContext({
        viewport: { width: 1440, height: 900 },
        reducedMotion: "reduce",
      });
      page = await context.newPage();
      await page.addInitScript((theme) => localStorage.setItem("brand-ui-theme", theme), theme);
      page.on("pageerror", (error) => errors.push(error.message));
      await page.goto(`${base}/#d/${folder}/${direction}.yaml`);
      const scope = '[data-lens-pane="technical"]';
      await page.locator(`${scope} [data-handleid="in:inner:top"]`).waitFor({ state: "attached" });
      await page.locator(`${scope} .react-flow__node[data-id="t"]`).waitFor({ state: "visible" });
      await page.waitForFunction(
        (scope) =>
          document.querySelectorAll(`${scope} [data-slot="data-flow-edge"][data-routed="elk"]`)
            .length === 4,
        scope,
      );
      const geometry = await page.evaluate((scope) => {
        const root = document.querySelector(scope);
        const cases = [
          ["a->t.top", "in:inner:top", false],
          ["b->t.right", "in:inner:right", false],
          ["t.top->b", "out:inner:top", true],
          ["t.right->a", "out:inner:right", true],
        ];
        return cases.map(([edge, handle, start]) => {
          const line = root.querySelector(
            `.react-flow__edge[data-id="${CSS.escape(edge)}"] [data-slot="data-flow-edge"]`,
          );
          const dot = root.querySelector(
            `.react-flow__node[data-id="t"] [data-handleid="${handle}"]`,
          );
          if (!line || !dot) throw Error(`Missing ${edge}/${handle}`);
          const point = line
            .getPointAtLength(start ? 0 : line.getTotalLength())
            .matrixTransform(line.getScreenCTM());
          const box = dot.getBoundingClientRect();
          // React Flow anchors an edge on the outward face of its handle, not its center.
          const x = start ? box.right : box.left,
            y = box.y + box.height / 2;
          return {
            edge,
            handle,
            distance: Math.hypot(point.x - x, point.y - y),
            x,
            y,
            routed: line.dataset.routed,
          };
        });
      }, scope);
      for (const row of geometry) {
        assert.ok(
          row.distance < 2,
          `${direction}/${theme} ${row.edge} misses ${row.handle}: ${row.distance}px`,
        );
        assert.equal(row.routed, "elk");
      }
      assert.ok(
        Math.abs(geometry[0].y - geometry[1].y) > 3,
        "distinct named rows have distinct attachment points",
      );
      if (evidence) await page.screenshot({ path: `${evidence}/${direction}-${theme}.png` });
      results.push({ direction, theme, geometry });
      await context.close();
    }
  }
  assert.deepEqual(errors, []);
  const output = { results, errors };
  if (evidence) await writeFile(`${evidence}/results.json`, JSON.stringify(output, null, 2));
  console.log(JSON.stringify(output, null, 2));
} catch (error) {
  if (evidence && page && !page.isClosed())
    await page.screenshot({ path: `${evidence}/failure.png` });
  throw error;
} finally {
  await browser.close();
  await rm(dir, { recursive: true, force: true });
}
