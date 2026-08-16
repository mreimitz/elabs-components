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
  FONT_UPSTREAM,
  MD_END,
  MD_START,
  collectFonts,
  distributablePackages,
  normalizeAuthor,
  npmUrl,
  readOflCopyright,
  renderMarkdown,
  sortEntries,
  spliceMarkdown,
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
    "Copyright 2020 The Inter Project Authors\n\nThis Font Software is licensed…\n",
  );
  mkdirSync(join(dir, "unlicensed-face"), { recursive: true });

  const fonts = collectFonts(dir);
  assert.equal(fonts.length, 1, "a face with no OFL.txt contributes no entry");
  assert.equal(fonts[0].copyright, "Copyright 2020 The Inter Project Authors");
  assert.equal(fonts[0].required, true, "the OFL obliges the notice to ship");
  assert.equal(fonts[0].name, "Inter");
  assert.equal(fonts[0].url, "https://github.com/rsms/inter", "every credit carries a link");
});

test("readOflCopyright: the licence BODY's boilerplate is never mistaken for the notice", () => {
  // The bug this locks out: Source Code Pro and Source Sans 3 ship an OFL.txt
  // whose header is just "Google Inc." — no copyright line at all. A whole-file
  // scan matched the OFL body's own phrase "…including any relevant copyright
  // statement(s)." and shipped `copyright: "copyright statement(s)."` as the
  // displayed notice for both faces, past a gate that only checked non-emptiness.
  const noHeaderNotice = [
    "Google Inc.",
    "",
    "This Font Software is licensed under the SIL Open Font License, Version 1.1.",
    "",
    "…in all copies … including any relevant",
    "copyright statement(s).",
  ].join("\n");
  assert.equal(readOflCopyright(noHeaderNotice), null, "boilerplate is not a notice");

  const withHeaderNotice = [
    "Copyright 2020 The Inter Project Authors (https://github.com/rsms/inter)",
    "",
    "This Font Software is licensed under the SIL Open Font License, Version 1.1.",
    "copyright statement(s).",
  ].join("\n");
  assert.equal(
    readOflCopyright(withHeaderNotice),
    "Copyright 2020 The Inter Project Authors (https://github.com/rsms/inter)",
  );
});

test("collectFonts: a face whose OFL has no header notice falls back to the upstream licence", () => {
  const dir = tmp();
  mkdirSync(join(dir, "source-code-pro"), { recursive: true });
  writeFileSync(
    join(dir, "source-code-pro", "OFL.txt"),
    "Google Inc.\n\nThis Font Software is licensed under the SIL Open Font License, Version 1.1.\ncopyright statement(s).\n",
  );
  const [font] = collectFonts(dir);
  assert.equal(font.copyright, FONT_UPSTREAM["source-code-pro"].copyrightFallback);
  assert.match(font.copyright, /^Copyright 2010-2020 Adobe/);
  assert.equal(font.name, "Source Code Pro", "not the hyphen-title-cased directory name");
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
  assert.match(out, /ATTRIBUTION\.md fresh/);
  assert.match(out, /all named and linked/);
});

test("gate: FAILS when the committed ATTRIBUTION.md is stale", () => {
  // The markdown is the PUBLIC face of the dataset; a gate that only watched the
  // TS module would let the page drift from the product silently.
  const md = join(root, "ATTRIBUTION.md");
  const original = readFileSync(md, "utf8");
  writeFileSync(md, original.replace("## Adapted & vendored source", "## Tampered"));
  try {
    assert.throws(
      () => execFileSync("node", [join(here, "gen-attributions.mjs"), "--check"], { cwd: root }),
      /Command failed/,
      "a tampered ATTRIBUTION.md must fail the gate",
    );
  } finally {
    writeFileSync(md, original);
  }
});

test("spliceMarkdown: replaces only the marked region, keeping hand-authored prose", () => {
  const doc = `# Attribution\n\nHand-written intro.\n\n${MD_START}\nOLD\n${MD_END}\n\nHand-written outro.\n`;
  const out = spliceMarkdown(doc, "NEW");
  assert.match(out, /Hand-written intro\./);
  assert.match(out, /Hand-written outro\./);
  assert.match(out, /NEW/);
  assert.ok(!out.includes("OLD"), "the generated region is replaced");
});

test("spliceMarkdown: REFUSES a file whose markers were removed", () => {
  // Silently overwriting would destroy the contributor-facing prose.
  assert.throws(() => spliceMarkdown("# Attribution\n\nNo markers here.\n", "NEW"), /markers/);
});

test("renderMarkdown: every entry is a followable link, and empty usedBy renders", () => {
  const md = renderMarkdown([
    {
      category: "source",
      name: "mapcn",
      license: "MIT",
      copyright: "Copyright (c) 2025 Anmoldeep Singh",
      url: "https://github.com/AnmolSaini16/mapcn",
      usedBy: ["@elabs/components-maps"],
      required: false,
      note: "Adapted.",
      version: null,
    },
    {
      category: "source",
      name: "Web Interface Guidelines",
      license: "MIT",
      copyright: "Copyright (c) 2025 Vercel Labs",
      url: "https://github.com/vercel-labs/web-interface-guidelines",
      usedBy: [], // governance we adopted — borrowed, credited, in no package
      required: false,
      note: "Governance.",
      version: null,
    },
  ]);
  assert.match(md, /\[mapcn\]\(https:\/\/github\.com\/AnmolSaini16\/mapcn\)/);
  assert.match(md, /\| — \|/, "an entry reaching no package still renders a row");
});

test("the shipped dataset credits AI Elements under Apache-2.0, not MIT", () => {
  // It was credited as MIT for its whole life here. Apache-2.0 carries a notice
  // AND a state-your-modifications obligation that MIT does not, so the wrong
  // identifier was a live compliance error, not a typo.
  const generated = readFileSync(
    join(root, "packages/ui/src/components/attribution-panel/attributions.generated.ts"),
    "utf8",
  );
  assert.match(generated, /id: "vercel-ai-elements"[\s\S]{0,300}license: "Apache-2\.0"/);
  const aiBarrel = readFileSync(join(root, "packages/ai/src/index.ts"), "utf8");
  assert.match(aiBarrel, /Copyright 2023 Vercel, Inc\./, "the notice ships with the source");
  assert.match(aiBarrel, /MODIFICATIONS/, "Apache-2.0 §4(b) requires stating the files changed");
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
