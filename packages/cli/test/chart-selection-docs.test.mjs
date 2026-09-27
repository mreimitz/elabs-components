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
import { keyPropsFor, CHARTS_PKG } from "../lib/chart-selection-docs.mjs";

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
