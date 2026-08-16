/**
 * Self-test for the attribution generator + gate.
 *
 * A gate that can silently stop firing is worse than none, so this plants bad
 * fixtures and asserts the generator's pure helpers behave — including the two
 * failure modes that would quietly break the product's legal position: a REQUIRED
 * notice losing its copyright line, and the dataset going stale.
 */

import { strict as assert } from "node:assert";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import {
  CATEGORY_ORDER,
  collectFonts,
  distributablePackages,
  normalizeAuthor,
  npmUrl,
  sortEntries,
} from "./gen-attributions.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");

const tmp = () => mkdtempSync(join(tmpdir(), "attrib-"));

test("distributablePackages: skips a private package with no publishConfig", () => {
  const dir = tmp();
  for (const [name, json] of [
    ["shipped", { name: "@x/shipped", version: "1.0.0" }],
    ["internal", { name: "@x/internal", version: "1.0.0", private: true }],
    [
      "private-but-published",
      { name: "@x/pbp", version: "1.0.0", private: true, publishConfig: {} },
    ],
  ]) {
    mkdirSync(join(dir, name), { recursive: true });
    writeFileSync(join(dir, name, "package.json"), JSON.stringify(json));
  }
  const names = distributablePackages(dir).map((p) => p.json.name);
  assert.deepEqual(names, ["@x/pbp", "@x/shipped"]);
});

test("normalizeAuthor: accepts both manifest shapes, strips email AND homepage", () => {
  assert.equal(normalizeAuthor("Luke Edwards <luke@example.com>"), "Luke Edwards");
  assert.equal(normalizeAuthor({ name: "Vercel" }), "Vercel");
  assert.equal(normalizeAuthor(undefined), null);
  // An embedded homepage would otherwise register as a reachable origin.
  assert.equal(normalizeAuthor("Titus Wormer (https://wooorm.com)"), "Titus Wormer");
  assert.equal(
    normalizeAuthor("A. Dev <a@dev.io> (https://a.dev)"),
    "A. Dev",
    "both forms stripped together",
  );
});

// Dependencies link to npm, NOT to their own homepages — otherwise every new dep
// injects an arbitrary origin into the `origins:check` security inventory. This
// asserts the single-origin property that keeps that inventory meaningful.
test("npmUrl: every dependency resolves to the one npm origin", () => {
  assert.equal(npmUrl("clsx"), "https://www.npmjs.com/package/clsx");
  assert.equal(
    npmUrl("@radix-ui/react-dialog"),
    "https://www.npmjs.com/package/@radix-ui/react-dialog",
  );
  const hosts = new Set(
    ["clsx", "zod", "@tanstack/react-table"].map((d) => new URL(npmUrl(d)).host),
  );
  assert.deepEqual([...hosts], ["www.npmjs.com"], "one origin for the whole dependency tail");
});

test("collectFonts: reads the notice from the shipped OFL, and skips a face without one", () => {
  const dir = tmp();
  mkdirSync(join(dir, "inter"), { recursive: true });
  writeFileSync(
    join(dir, "inter", "OFL.txt"),
    "This Font Software is licensed…\nCopyright 2020 The Inter Project Authors\n",
  );
  mkdirSync(join(dir, "unlicensed-face"), { recursive: true });

  const fonts = collectFonts(dir);
  assert.equal(fonts.length, 1, "a face with no OFL.txt contributes no entry");
  assert.equal(fonts[0].copyright, "Copyright 2020 The Inter Project Authors");
  assert.equal(fonts[0].required, true, "the OFL obliges the notice to ship");
  assert.equal(fonts[0].name, "Inter");
});

test("sortEntries: category order first, then required-first, then name", () => {
  const sorted = sortEntries([
    { category: "dependency", required: false, name: "zod" },
    { category: "data", required: false, name: "Courtesy" },
    { category: "data", required: true, name: "OpenStreetMap" },
    { category: "font", required: true, name: "Inter" },
  ]).map((e) => e.name);
  assert.deepEqual(sorted, ["OpenStreetMap", "Courtesy", "Inter", "zod"]);
  assert.deepEqual(CATEGORY_ORDER, ["data", "source", "font", "dependency"]);
});

test("gate: passes on the committed tree", () => {
  const out = execFileSync("node", [join(here, "gen-attributions.mjs"), "--check"], {
    cwd: root,
    encoding: "utf8",
  });
  assert.match(out, /dataset is fresh/);
});

test("gate: FAILS when the committed dataset is stale", () => {
  const generated = join(
    root,
    "packages/ui/src/components/attribution-panel/attributions.generated.ts",
  );
  const original = readFileSync(generated, "utf8");
  writeFileSync(generated, original.replace("export const ATTRIBUTIONS", "export const TAMPERED"));
  try {
    assert.throws(
      () => execFileSync("node", [join(here, "gen-attributions.mjs"), "--check"], { cwd: root }),
      /Command failed/,
      "a tampered dataset must fail the gate",
    );
  } finally {
    writeFileSync(generated, original);
  }
});

test("the shipped dataset carries the required map notices with copyright lines", () => {
  const generated = readFileSync(
    join(root, "packages/ui/src/components/attribution-panel/attributions.generated.ts"),
    "utf8",
  );
  // Text-level, deliberately: the emitted module is Prettier-formatted TS with
  // UNQUOTED keys, so it is not JSON and must not be parsed as such. The typed
  // assertion over the real objects lives in the component's vitest suite
  // (attribution-panel.test.tsx), which can import the module.
  assert.match(generated, /id: "openstreetmap"/, "ODbL notice present");
  assert.match(generated, /id: "carto"/, "basemap provider notice present");
  assert.match(generated, /© OpenStreetMap contributors/, "the ODbL credit is the literal text");
  assert.ok(
    !/url: "https:\/\/(?!www\.npmjs\.com)[^"]*"[^}]*category: "dependency"/s.test(generated),
    "dependency entries link to npm, keeping the origins inventory to one host",
  );
});
