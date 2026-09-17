/**
 * story-crawl.mjs — open every story in a real browser and look at what rendered.
 *
 * WHY THIS EXISTS. The Storybook Vitest project renders each story in its own
 * bare root and asserts the play function. That is a different DOM from the one
 * a visitor gets: the published canvas is `layout: "centered"`, so
 * `#storybook-root` is a shrink-to-fit flex item. On 2026-09-17, 26 chart
 * stories — `Charts/BarChart/Default` among them — mounted an SVG with zero
 * marks on the live site (`#storybook-root` 32 px wide, the story's own
 * `w-full max-w-[…]` wrapper 0 px) while their play functions were green in CI.
 * Several of them were even RED on the live site, and nothing noticed, because
 * nothing ever opened the published Storybook.
 *
 * So this is deliberately NOT another assertion-library run: it loads the page a
 * customer loads and fails on the three things a customer would see —
 *
 *   1. the Storybook error overlay, VISIBLE (`.sb-errordisplay` is always in the
 *      DOM; `display: none` until something throws — the first cut of this check
 *      reported every story as broken by testing for presence);
 *   2. an uncaught page error;
 *   3. a chart that measured to nothing: `#storybook-root`'s first child 0 px in
 *      either axis, or an `<svg>` with no marks in it.
 *
 * Pure judgement (`judgeStory`) is separated from the browser work
 * (`crawlStories`) so the rules are unit-tested without a browser —
 * `scripts/story-crawl.test.mjs`.
 *
 * Dependency-free except for the Playwright browser the caller injects; ESM.
 */

/** Story ids whose whole point is that nothing is drawn yet. */
const NOT_YET_DRAWN = /(empty|loading|error|skeleton|no-data|placeholder|unavailable)/i;

/** An `<svg>` mark: a drawn shape, as opposed to defs/clip paths and the root node. */
export const MARK_SELECTOR = "path, rect, circle, ellipse, line, polyline, polygon, text, image";

/**
 * Is this story one whose canvas must actually contain a drawing? Charts are the
 * family where "renders, but blank" is invisible to a play function, and they
 * are the family that broke. Keyed on the component's own source path so a chart
 * shown under another sidebar group still counts.
 */
export function isChartStory(entry) {
  const path = String(entry?.componentPath ?? entry?.importPath ?? "");
  const title = String(entry?.title ?? "");
  if (NOT_YET_DRAWN.test(String(entry?.id ?? ""))) return false;
  return /packages\/charts\//.test(path) || /^(Charts|Dashboard)\//.test(title);
}

/** The URL a visitor's browser actually fetches for one story. */
export function storyUrl(base, id, { theme = "light", mode = "light" } = {}) {
  const root = String(base).replace(/\/+$/, "");
  const globals = [theme && `theme:${theme}`, mode && `mode:${mode}`].filter(Boolean).join(";");
  return `${root}/iframe.html?id=${encodeURIComponent(id)}&viewMode=story${
    globals ? `&globals=${globals}` : ""
  }`;
}

/**
 * What is wrong with one story, given what the browser saw. Pure; returns a list
 * of human-readable problems (empty = the story is fine).
 *
 * `probe` is `{ loadError, overlay, pageErrors, firstChild: { width, height },
 * svgCount, markCount, canvasCount }`.
 */
export function judgeStory(entry, probe) {
  const out = [];
  if (probe?.loadError) out.push(`did not load — ${probe.loadError}`);
  if (probe?.overlay)
    out.push(`error overlay: ${String(probe.overlay).replace(/\s+/g, " ").trim()}`);
  for (const e of probe?.pageErrors ?? []) out.push(`page error: ${e}`);
  if (out.length > 0 || !isChartStory(entry)) return out;

  const { width = 0, height = 0 } = probe?.firstChild ?? {};
  if (width === 0 || height === 0)
    out.push(
      `chart canvas measured ${width}×${height} px — the story renders nothing a reader can see`,
    );
  // A canvas-rendered chart (CanvasLayer) draws no SVG marks by design.
  else if (probe?.svgCount > 0 && probe?.markCount === 0 && !(probe?.canvasCount > 0))
    out.push("chart SVG has zero marks — it mounted but drew nothing");
  return out;
}

/**
 * What one browser page reports about a story. Runs INSIDE the page.
 *
 * The measured element is the first child that actually generates a BOX.
 * `display: contents` elements have no box of their own, so their rect is always
 * 0×0 — `Dashboard/Chrome/DashboardThemeScope` renders a `class="contents"`
 * provider wrapper around a perfectly visible 1248×256 sheet and was reported
 * broken by the first real crawl. Walk past those wrappers before measuring.
 */
const PROBE = `(() => {
  const overlayEl = document.querySelector(".sb-errordisplay");
  const root = document.querySelector("#storybook-root") || document.querySelector("#root");
  let child = root && root.firstElementChild;
  while (child && getComputedStyle(child).display === "contents") child = child.firstElementChild;
  const box = child ? child.getBoundingClientRect() : { width: 0, height: 0 };
  const svgs = root ? root.querySelectorAll("svg") : [];
  let marks = 0;
  for (const svg of svgs) marks += svg.querySelectorAll(${JSON.stringify(MARK_SELECTOR)}).length;
  return {
    overlay: overlayEl && overlayEl.offsetParent !== null ? overlayEl.textContent.slice(0, 300) : null,
    firstChild: { width: Math.round(box.width), height: Math.round(box.height) },
    svgCount: svgs.length,
    markCount: marks,
    canvasCount: root ? root.querySelectorAll("canvas").length : 0,
  };
})()`;

/** The page is settled when the story mounted something, or the overlay is up. */
const READY = `(() => {
  const r = document.querySelector("#storybook-root") || document.querySelector("#root");
  const o = document.querySelector(".sb-errordisplay");
  return (o && o.offsetParent !== null) || (r && r.children.length > 0);
})()`;

/**
 * A story that never stops working. Playwright's `timeout` covers waiting for
 * something to APPEAR; `page.evaluate` has no timeout at all, so a story that
 * pegs the renderer (a runaway animation frame, an endless layout loop) blocks
 * the worker for ever. The first full run of this crawl stopped dead at
 * 1900/1958 and sat there: no verdict, no failure, nothing to read. A crawl
 * that can hang is worse than no crawl — in CI it burns the job timeout and
 * reports nothing. Every story therefore gets one hard deadline, and blowing it
 * is a FAILURE, not a skip.
 */
const HUNG = Symbol("hung");

/** Resolve to `HUNG` if `promise` has not settled within `ms`. Never rejects. */
export async function withDeadline(promise, ms) {
  let timer;
  // NOT unref'd on purpose: a hung page holds nothing else on the event loop, so
  // an unref'd deadline lets the process exit before the verdict is written.
  const deadline = new Promise((resolve) => {
    timer = setTimeout(() => resolve(HUNG), ms);
  });
  try {
    return await Promise.race([
      promise.then(
        (v) => v,
        (err) => ({ __error: err }),
      ),
      deadline,
    ]);
  } finally {
    clearTimeout(timer);
  }
}

export { HUNG };

/**
 * Open every entry in `entries` and judge it. `browser` is a Playwright browser
 * (or anything with the same `newContext`), injected so the caller owns the
 * install. Returns `{ visited, failures: [{ id, title, problems }] }`.
 */
export async function crawlStories({
  browser,
  base,
  entries,
  concurrency = 8,
  settleMs = 700,
  timeoutMs = 30000,
  // A slow load, a slow settle AND slack on top: set to the exact worst case, the
  // deadline fires at the same moment Playwright's own timeout would, and a story
  // that is merely slow is reported as "never settled" instead of by its real
  // error. `AI/Persona/Live remote artwork` — the one story that reaches the
  // network — did exactly that under concurrency 8.
  storyTimeoutMs = timeoutMs * 2 + settleMs + 10000,
  log = () => {},
}) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const failures = [];
  const queue = [...entries];
  let visited = 0;

  async function visit(entry) {
    const page = await context.newPage();
    const pageErrors = [];
    page.on("pageerror", (e) => pageErrors.push(String(e?.message ?? e).slice(0, 200)));
    let loadError = null;
    let probe = null;

    const outcome = await withDeadline(
      (async () => {
        await page.goto(storyUrl(base, entry.id), { waitUntil: "load", timeout: timeoutMs });
        await page.waitForFunction(READY, undefined, { timeout: timeoutMs }).catch(() => {});
        await page.waitForTimeout(settleMs);
        return page.evaluate(PROBE);
      })(),
      storyTimeoutMs,
    );
    if (outcome === HUNG) {
      loadError = `it never settled within ${storyTimeoutMs}ms (the page is still working)`;
    } else if (outcome && outcome.__error) {
      loadError = String(outcome.__error?.message ?? outcome.__error)
        .split("\n")[0]
        .slice(0, 160);
    } else {
      probe = outcome;
    }

    const problems = judgeStory(entry, { ...(probe ?? {}), loadError, pageErrors });
    if (problems.length > 0) failures.push({ id: entry.id, title: entry.title, problems });
    // A hung page can hang its own close, too — never let cleanup stall the queue.
    await withDeadline(
      Promise.resolve(page.close()).catch(() => {}),
      5000,
    );
    if (++visited % 100 === 0) log(`  …${visited}/${entries.length} stories`);
  }

  await Promise.all(
    Array.from({ length: Math.max(1, concurrency) }, async () => {
      while (queue.length > 0) await visit(queue.shift());
    }),
  );
  await withDeadline(
    Promise.resolve(context.close()).catch(() => {}),
    10000,
  );
  failures.sort((a, b) => String(a.id).localeCompare(String(b.id)));
  return { visited, failures };
}

/** The story entries of a Storybook index, sorted — `index.json` as served. */
export function storiesFromIndex(index) {
  return Object.values(index?.entries ?? {})
    .filter((e) => e.type === "story")
    .sort((a, b) => String(a.id).localeCompare(String(b.id)));
}
