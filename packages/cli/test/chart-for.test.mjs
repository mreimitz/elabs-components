import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { extractChartDataShapes } from "../lib/core.mjs";
import { matchChartFor, renderChartForText } from "../lib/chart-for.mjs";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");

// ── the extractor (source → manifest) ────────────────────────────────────────

const HEATMAP_LIKE = `
/**
 * A container that closes two readings.
 *
 * @dataShape two categorical axes (weekday by hour, for example) with one numeric value per
 *   cell — ticket volume, event counts
 * @dataShape one measure per calendar day over several months
 * @avoidWhen more than about 10 columns of continuous data
 */
export const HeatmapChart = forwardRef(function HeatmapChart() {});

/** A tuning constant that lives in the same file. */
export const CALENDAR_ROWS = 7;
`;

test("extractChartDataShapes reads repeated @dataShape tags and folds continuation lines", () => {
  const got = extractChartDataShapes(HEATMAP_LIKE, "HeatmapChart");
  assert.deepEqual(got.dataShapes, [
    "two categorical axes (weekday by hour, for example) with one numeric value per cell — ticket volume, event counts",
    "one measure per calendar day over several months",
  ]);
  assert.equal(got.avoidWhen, "more than about 10 columns of continuous data");
});

test("extractChartDataShapes does NOT leak a container's tags onto a sibling export", () => {
  // The regression this guards: a whole-file scan handed `CALENDAR_ROWS` the
  // heatmap's data shapes, and it then surfaced as a `chart-for` candidate.
  assert.equal(extractChartDataShapes(HEATMAP_LIKE, "CALENDAR_ROWS"), null);
});

test("extractChartDataShapes ignores a docblock that is not adjacent to the declaration", () => {
  const src = `
/**
 * @dataShape somebody else's shape
 */
import { forwardRef } from "react";

export const Chart = forwardRef(function Chart() {});
`;
  assert.equal(extractChartDataShapes(src, "Chart"), null);
});

test("extractChartDataShapes returns null for an untagged component", () => {
  assert.equal(extractChartDataShapes("export const Plain = () => null;", "Plain"), null);
  assert.equal(extractChartDataShapes("", "Plain"), null);
});

// ── the ranking (manifest → candidates) ──────────────────────────────────────

const MANIFEST = {
  packages: {
    "@elabs-ai/components-charts": {
      intent: {
        HeatmapChart: {
          dataShapes: [
            "two categorical axes (weekday by hour, for example) with one numeric value per cell — ticket volume, event counts",
            "one measure per calendar day over several months",
          ],
          avoidWhen: "more than about 10 columns of continuous data",
        },
        UnitChart: {
          dataShapes: [
            "parts of a whole as discrete unit counts rather than a percentage",
            "one tally row per category, ticks summing to a total — ticket volume by weekday",
          ],
        },
        LineChart: { dataShapes: ["one or more measures over continuous time"] },
        Button: { purpose: "an authored intent row with no data shapes" },
      },
    },
  },
};

test("matchChartFor ranks by whole-token overlap, best-matching shape wins", () => {
  const got = matchChartFor(MANIFEST, "weekday by hour ticket volume");
  assert.deepEqual(
    got.map((c) => [c.name, c.score]),
    [
      ["HeatmapChart", 4],
      ["UnitChart", 3],
    ],
  );
  // the quoted reason is the container's OWN best-matching tag, not an average
  assert.match(got[0].matchedShape, /weekday by hour/);
  assert.match(got[1].matchedShape, /one tally row per category/);
  assert.equal(got[0].avoidWhen, "more than about 10 columns of continuous data");
  assert.equal(got[1].avoidWhen, null);
});

test("matchChartFor skips intent entries that declare no data shapes", () => {
  assert.equal(
    matchChartFor(MANIFEST, "authored intent row").some((c) => c.name === "Button"),
    false,
  );
});

test("matchChartFor returns nothing for a stopword-only query or a missing manifest", () => {
  assert.deepEqual(matchChartFor(MANIFEST, "the of and by"), []);
  assert.deepEqual(matchChartFor(null, "weekday by hour"), []);
});

test("matchChartFor honours its limit and breaks ties alphabetically", () => {
  assert.equal(matchChartFor(MANIFEST, "one measure over time", { limit: 1 }).length, 1);
  const tied = matchChartFor(
    {
      packages: {
        p: {
          intent: {
            Zeta: { dataShapes: ["rank over periods"] },
            Alpha: { dataShapes: ["rank over periods"] },
          },
        },
      },
    },
    "rank",
  );
  assert.deepEqual(
    tied.map((c) => c.name),
    ["Alpha", "Zeta"],
  );
});

test("renderChartForText names every candidate and says so when there are none", () => {
  const text = renderChartForText("weekday by hour", matchChartFor(MANIFEST, "weekday by hour"));
  assert.match(text, /1\. HeatmapChart/);
  assert.match(text, /avoid when:/);
  assert.match(renderChartForText("zzz", []), /no chart container declared a matching @dataShape/);
});

// ── the shipped manifest (the acceptance example, end to end) ────────────────

test("the committed manifest answers the chart-selection acceptance example", () => {
  const manifest = JSON.parse(readFileSync(join(repoRoot, "brand-ui.manifest.json"), "utf8"));
  const got = matchChartFor(manifest, "weekday by hour ticket volume");
  assert.ok(got.length >= 2, "at least two candidates");
  assert.equal(got[0].name, "HeatmapChart");
  assert.match(got[0].matchedShape, /mode="dot"/);
  assert.equal(got[1].name, "UnitChart");
  assert.match(got[1].matchedShape, /layout="rows"/);
});

test("every chart container in the shipped manifest declares a data shape", () => {
  const manifest = JSON.parse(readFileSync(join(repoRoot, "brand-ui.manifest.json"), "utf8"));
  const charts = manifest.packages["@elabs-ai/components-charts"];
  const containers = charts.components
    .map((c) => c.name)
    .filter(
      (n) =>
        (/Chart$/.test(n) || n === "Gauge" || n === "Gantt") &&
        n !== "AutoChart" &&
        n !== "ChartFallback",
    );
  const untagged = containers.filter((n) => !charts.intent?.[n]?.dataShapes?.length);
  assert.deepEqual(untagged, [], `containers with no @dataShape tag: ${untagged.join(", ")}`);
});
