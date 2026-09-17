import { test } from "node:test";
import assert from "node:assert/strict";
import {
  HUNG,
  crawlStories,
  isChartStory,
  judgeStory,
  storiesFromIndex,
  storyUrl,
  withDeadline,
} from "./lib/story-crawl.mjs";

const chart = { id: "charts-barchart--default", title: "Charts/BarChart" };
const plain = { id: "core-button--default", title: "Core/Button" };
const drawn = { firstChild: { width: 560, height: 288 }, svgCount: 1, markCount: 24 };

test("storyUrl is the URL a visitor's browser fetches", () => {
  assert.equal(
    storyUrl("http://localhost:6006/", "charts-barchart--default"),
    "http://localhost:6006/iframe.html?id=charts-barchart--default&viewMode=story&globals=theme:light;mode:light",
  );
  assert.match(storyUrl("https://elabs-ai.com", "x--y", { theme: "dark" }), /globals=theme:dark/);
});

test("a chart is the family where a blank canvas is invisible to a play function", () => {
  assert.ok(isChartStory(chart));
  assert.ok(
    isChartStory({ id: "core-metriccard--default", componentPath: "packages/charts/x.tsx" }),
  );
  assert.ok(!isChartStory(plain));
  // Stories whose point is that nothing is drawn yet must not fail the 0-mark rule.
  assert.ok(!isChartStory({ id: "charts-barchart--empty", title: "Charts/BarChart" }));
  assert.ok(
    !isChartStory({ id: "charts-heatmapchart--loading-dark", title: "Charts/HeatmapChart" }),
  );
});

test("a healthy story has no problems", () => {
  assert.deepEqual(judgeStory(chart, drawn), []);
  assert.deepEqual(judgeStory(plain, { firstChild: { width: 0, height: 0 } }), []);
});

test("the three things a visitor would see are the three failures", () => {
  assert.match(judgeStory(plain, { loadError: "Timeout 30000ms exceeded" })[0], /did not load/);
  // `.sb-errordisplay` is ALWAYS in the DOM — only a VISIBLE one counts, which is
  // what `offsetParent !== null` in the probe decides. Presence reported every story.
  assert.match(
    judgeStory(plain, { overlay: "Couldn't find story\n  matching id" })[0],
    /error overlay: Couldn't find story matching id/,
  );
  assert.deepEqual(judgeStory(plain, { pageErrors: ["x is not a function"] }), [
    "page error: x is not a function",
  ]);
});

test("a chart that measured to nothing fails — the 2026-09-17 regression", () => {
  const problems = judgeStory(chart, { firstChild: { width: 0, height: 288 }, svgCount: 1 });
  assert.equal(problems.length, 1);
  assert.match(problems[0], /measured 0×288 px/);
});

test("a chart that mounted but drew nothing fails; a canvas chart does not", () => {
  assert.match(
    judgeStory(chart, { firstChild: { width: 560, height: 288 }, svgCount: 1, markCount: 0 })[0],
    /zero marks/,
  );
  assert.deepEqual(
    judgeStory(
      { id: "charts-canvaslayer--fifty-thousand-marks", title: "Charts/CanvasLayer" },
      { firstChild: { width: 560, height: 288 }, svgCount: 1, markCount: 0, canvasCount: 1 },
    ),
    [],
  );
});

test("storiesFromIndex keeps stories only, sorted", () => {
  const index = {
    entries: {
      "b--two": { id: "b--two", type: "story" },
      "a--docs": { id: "a--docs", type: "docs" },
      "a--one": { id: "a--one", type: "story" },
    },
  };
  assert.deepEqual(
    storiesFromIndex(index).map((e) => e.id),
    ["a--one", "b--two"],
  );
  assert.deepEqual(storiesFromIndex(undefined), []);
});

test("crawlStories visits every entry and reports only the broken ones", async () => {
  // A fake browser: each page replays a scripted probe for its story id.
  const probes = {
    "core-button--default": drawn,
    "charts-barchart--default": { firstChild: { width: 0, height: 0 }, svgCount: 1 },
  };
  let current = null;
  const page = {
    on() {},
    async goto(url) {
      current = new URL(url).searchParams.get("id");
    },
    async waitForFunction() {},
    async waitForTimeout() {},
    async evaluate() {
      return probes[current];
    },
    async close() {},
  };
  const browser = {
    async newContext() {
      return {
        async newPage() {
          return page;
        },
        async close() {},
      };
    },
  };

  const { visited, failures } = await crawlStories({
    browser,
    base: "http://localhost:6006",
    entries: storiesFromIndex({
      entries: {
        "core-button--default": { id: "core-button--default", type: "story", title: "Core/Button" },
        "charts-barchart--default": {
          id: "charts-barchart--default",
          type: "story",
          title: "Charts/BarChart",
        },
      },
    }),
    concurrency: 1,
    settleMs: 0,
  });
  assert.equal(visited, 2);
  assert.equal(failures.length, 1);
  assert.equal(failures[0].id, "charts-barchart--default");
  assert.match(failures[0].problems[0], /measured 0×0 px/);
});

test("a deadline turns a promise that never settles into a value, never a reject", async () => {
  assert.equal(await withDeadline(new Promise(() => {}), 10), HUNG);
  assert.equal(await withDeadline(Promise.resolve("probe"), 1000), "probe");
  const { __error } = await withDeadline(Promise.reject(new Error("boom")), 1000);
  assert.equal(__error.message, "boom");
});

test("a story that never settles FAILS the crawl instead of hanging it", async () => {
  // The first full run stopped at 1900/1958 and sat there: `page.evaluate` has
  // no timeout, so one story pegging the renderer blocked its worker for ever.
  const entries = storiesFromIndex({
    entries: {
      "a--hangs": { id: "a--hangs", type: "story", title: "A" },
      "b--fine": { id: "b--fine", type: "story", title: "B" },
    },
  });
  let closed = 0;
  const context = {
    async newPage() {
      let id = null;
      return {
        on() {},
        async goto(url) {
          id = new URL(url).searchParams.get("id");
        },
        async waitForFunction() {},
        async waitForTimeout() {},
        async evaluate() {
          if (id === "a--hangs") return new Promise(() => {});
          return drawn;
        },
        async close() {
          closed += 1;
        },
      };
    },
    async close() {},
  };

  const { visited, failures } = await crawlStories({
    browser: {
      async newContext() {
        return context;
      },
    },
    base: "http://localhost:6006",
    entries,
    concurrency: 2,
    settleMs: 0,
    storyTimeoutMs: 30,
  });
  assert.equal(visited, 2);
  assert.equal(closed, 2); // the hung page is still closed — the queue keeps moving
  assert.equal(failures.length, 1);
  assert.equal(failures[0].id, "a--hangs");
  assert.match(failures[0].problems[0], /never settled within 30ms/);
});
