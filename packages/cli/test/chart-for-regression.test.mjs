/**
 * `chart_for` regression (RM-199): the definitions snapshot became a second source
 * for `dataShapes` / `avoidWhen` (see `core.mjs`'s `collectChartDataShapes`) and a
 * brand-new `targets` field started flowing through to every ranked candidate. This
 * file locks down that the OLD half of that output — every candidate's name, pkg,
 * score, matched shape text and avoid-when text — is byte-identical to what
 * `chart_for` printed before the change, for every chart family in the manifest at
 * the time, and that the only real difference is the new `targets` field arriving
 * (never a silent score/text drift).
 *
 * The baseline fixture (`fixtures/chart-for-regression/baseline.json`) was captured
 * from the pre-RM-199 commit `e5f37e50` (the branch point) — `matchChartFor` is a
 * pure function of `(manifest, query)` with no imports of its own, so re-running it
 * against that commit's own `brand-ui.manifest.json` and `chart-for.mjs` reproduces
 * exactly what `chart-for` printed on that day. To regenerate after an intentional
 * ranking change:
 *
 *   git show e5f37e50:brand-ui.manifest.json > /tmp/old-manifest.json
 *   git show e5f37e50:packages/cli/lib/chart-for.mjs > /tmp/old-chart-for.mjs
 *   # for every chart-kind family in /tmp/old-manifest.json, call
 *   # matchChartFor(oldManifest, family.dataShapes[0]) and record name/pkg/score/
 *   # matchedShape/avoidWhen per candidate.
 *
 * and review every diff before committing the new fixture.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { matchChartFor } from "../lib/chart-for.mjs";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");

const baseline = JSON.parse(
  readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), "fixtures/chart-for-regression/baseline.json"),
    "utf8",
  ),
);
const manifest = JSON.parse(readFileSync(join(repoRoot, "brand-ui.manifest.json"), "utf8"));

test("the baseline fixture itself predates targets (sanity: every recorded candidate has hasTargets: false)", () => {
  for (const family of baseline) {
    for (const candidate of family.candidates) {
      assert.equal(
        candidate.hasTargets,
        false,
        `${family.family} → ${candidate.name} should not have carried targets before RM-199`,
      );
    }
  }
});

for (const family of baseline) {
  test(`chart_for("${family.family}"'s own shape) still ranks the same candidates, in the same order, with the same score and text`, () => {
    const got = matchChartFor(manifest, family.query);
    assert.equal(
      got.length,
      family.candidates.length,
      `${family.family}: candidate count changed (${got.length} vs ${family.candidates.length})`,
    );
    got.forEach((candidate, i) => {
      const want = family.candidates[i];
      assert.equal(candidate.name, want.name, `${family.family}[${i}]: name`);
      assert.equal(candidate.pkg, want.pkg, `${family.family}[${i}]: pkg`);
      assert.equal(candidate.score, want.score, `${family.family}[${i}]: score`);
      assert.equal(
        candidate.matchedShape,
        want.matchedShape,
        `${family.family}[${i}]: matchedShape`,
      );
      assert.equal(
        candidate.avoidWhen ?? null,
        want.avoidWhen,
        `${family.family}[${i}]: avoidWhen`,
      );
    });
  });
}

test("every candidate whose component carries manifest targets now prints them on the chart_for candidate (RM-199's one reviewed addition)", () => {
  let sawAtLeastOneTargets = false;
  for (const family of baseline) {
    const got = matchChartFor(manifest, family.query);
    for (const candidate of got) {
      const intentEntry = manifest.packages[candidate.pkg]?.intent?.[candidate.name];
      const expectTargets = Array.isArray(intentEntry?.targets) && intentEntry.targets.length > 0;
      const gotTargets = Array.isArray(candidate.targets) && candidate.targets.length > 0;
      assert.equal(
        gotTargets,
        expectTargets,
        `${family.family} → ${candidate.name}: targets presence should mirror the manifest's intent entry`,
      );
      if (gotTargets) {
        sawAtLeastOneTargets = true;
        for (const t of candidate.targets) {
          assert.ok(
            t.id && t.label && t.role,
            `${candidate.name}: each target needs id/label/role`,
          );
        }
      }
    }
  }
  assert.ok(
    sawAtLeastOneTargets,
    "expected at least one candidate across all families to carry targets",
  );
});
