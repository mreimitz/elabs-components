/**
 * `keyPropsFor` (review round 1, F05) — the six rows the 2026-09-25 review (F03, see
 * `chart-selection-docs.mjs`'s module docblock) found drifted from their real component:
 * RingChart claimed `value`/`max` (it takes `data`, with `label`/`value`/`maxValue` keys
 * inside each row), ChoroplethChart claimed `valueKey` (its `data` is a `FeatureCollection`
 * with no such key), Gauge claimed `min`/`max` (it has none), ParallelCoordinatesChart was
 * missing `entity`, NetworkChart claimed `edges` (it is `links`), Gantt claimed
 * `dependencies` (it has none). This suite pins each row's generated key-props list against
 * the real, committed snapshot — a fresh drift (a hand-typed catalog row, or a future bug in
 * `keyPropsFor` itself) reds here instead of quietly shipping a wrong prop name again.
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import { loadDefinitionsSnapshot } from "../lib/core.mjs";
import {
  keyPropsFor,
  dataShapeFor,
  avoidWhenFor,
  renderTable,
  CHARTS_PKG,
} from "../lib/chart-selection-docs.mjs";

const repoRoot = new URL("../../..", import.meta.url).pathname;
const snapshot = loadDefinitionsSnapshot(repoRoot);

test("keyPropsFor(RingChart) — data + each item field target, never value/max as own props", () => {
  const got = keyPropsFor(snapshot, "RingChart");
  assert.equal(got, "`data`, `data[].label`, `data[].value`, `data[].maxValue`");
  assert.doesNotMatch(got, /`value`|`max`/);
});

test("keyPropsFor(ChoroplethChart) — data only, never a valueKey the GeoJSON data has no room for", () => {
  const got = keyPropsFor(snapshot, "ChoroplethChart");
  assert.equal(got, "`data`");
  assert.doesNotMatch(got, /valueKey/);
});

test("keyPropsFor(Gauge) — its real required fields, never min/max it doesn't have", () => {
  const got = keyPropsFor(snapshot, "Gauge");
  assert.equal(got, "`centerValue`, `value`");
  assert.doesNotMatch(got, /`min`|`max`/);
});

test("keyPropsFor(ParallelCoordinatesChart) — includes entity, previously missing", () => {
  const got = keyPropsFor(snapshot, "ParallelCoordinatesChart");
  assert.equal(got, "`data`, `entity`, `dimensions`");
});

test("keyPropsFor(NetworkChart) — nodes/links, never the old edges misname", () => {
  const got = keyPropsFor(snapshot, "NetworkChart");
  assert.equal(got, "`nodes`, `links`, `layout`");
  assert.doesNotMatch(got, /edges/);
});

test("keyPropsFor(Gantt) — tasks only, never a dependencies prop it doesn't have", () => {
  const got = keyPropsFor(snapshot, "Gantt");
  assert.equal(got, "`tasks`");
  assert.doesNotMatch(got, /dependencies/);
});

test("keyPropsFor returns null for an id with no snapshot entry (a stale catalog row)", () => {
  assert.equal(keyPropsFor(snapshot, "NotAChart"), null);
});

test("every id this suite pins still has a real entry in the committed snapshot", () => {
  for (const id of [
    "RingChart",
    "ChoroplethChart",
    "Gauge",
    "ParallelCoordinatesChart",
    "NetworkChart",
    "Gantt",
  ]) {
    assert.ok(snapshot[CHARTS_PKG]?.[id], `${id} is missing from the committed snapshot`);
  }
});

test("HeatmapChart's calendar row (shapeIndex: 1) reads its OWN Shape and Avoid-when text, not the matrix row's", () => {
  const matrixShape = dataShapeFor(snapshot, "HeatmapChart", 0);
  const calendarShape = dataShapeFor(snapshot, "HeatmapChart", 1);
  assert.notEqual(calendarShape, matrixShape);
  assert.match(calendarShape, /calendar day/);

  const matrixAvoid = avoidWhenFor(snapshot, "HeatmapChart", 0);
  const calendarAvoid = avoidWhenFor(snapshot, "HeatmapChart", 1);
  assert.notEqual(calendarAvoid, matrixAvoid);
  assert.match(calendarAvoid, /calendar/);
});

test("BarChart's diverging-bar row (shapeIndex: 1) reads its OWN Shape and Avoid-when text, not the plain-bar row's", () => {
  const barShape = dataShapeFor(snapshot, "BarChart", 0);
  const divergingShape = dataShapeFor(snapshot, "BarChart", 1);
  assert.notEqual(divergingShape, barShape);
  assert.match(divergingShape, /signed measure/);

  const barAvoid = avoidWhenFor(snapshot, "BarChart", 0);
  const divergingAvoid = avoidWhenFor(snapshot, "BarChart", 1);
  assert.notEqual(divergingAvoid, barAvoid);
  assert.match(divergingAvoid, /zero baseline/);
});

test("renderTable escapes a literal | inside a cell instead of letting it split the row", () => {
  const table = renderTable(["Extra"], [['`mode="cell"|"dot"`']]);
  const lines = table.split("\n");
  assert.equal(lines.length, 3, "header + separator + one row");
  // The escaped pipe must not read as a column boundary: exactly 2 unescaped `|`
  // delimit the one-column row (the leading and trailing table bars).
  const unescapedBars = (lines[2].match(/(?<!\\)\|/g) ?? []).length;
  assert.equal(unescapedBars, 2, `row should have exactly 2 unescaped "|": ${lines[2]}`);
  assert.match(lines[2], /mode="cell"\\\|"dot"/);
});
