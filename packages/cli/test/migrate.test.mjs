/**
 * migrate.test.mjs — the brownfield analysis path (VP-03 #124).
 *
 * Exercises `scan` → `map` → `renderMigrationDocs` end to end against a
 * MUI-shaped fixture app, and locks the property that makes the whole path safe
 * to point at someone's repo: **it reads, it never writes.** The fixture's file
 * list AND every file's content are hashed before and after the run; a single
 * byte of drift fails the test.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtempSync, writeFileSync, mkdirSync, rmSync, readdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  scanRepo,
  mapComponents,
  scoreMapping,
  scanJsxTags,
  scanImports,
  renderMigrationDocs,
  MIGRATION_DOCS,
  MIGRATION_PHASES,
  SOURCE_ALIASES,
} from "../lib/engine.mjs";
import { findRepoRoot } from "../lib/core.mjs";

const root = findRepoRoot();

// ---- fixture ---------------------------------------------------------------

const APP_TSX = `import { Fragment } from "react";
import { Box, Button, Stack, Typography } from "@mui/material";
import { ZzUnknown } from "./zz-unknown";

export function App() {
  return (
    <Fragment>
      <Box sx={{ padding: 12 }} className="p-[12px] text-[13px]">
        <Typography variant="h1" component="h1">
          Pipeline runs
        </Typography>
        <Stack spacing={2}>
          <Button color="primary" onClick={() => undefined}>
            Save
          </Button>
          <Button color="secondary">Cancel</Button>
        </Stack>
        <ZzUnknown ratio={2} />
      </Box>
    </Fragment>
  );
}
`;

const PANEL_TSX = `import { Box, Button, Typography } from "@mui/material";

export function Panel() {
  return (
    <Box style={{ color: "#3366ff" }}>
      <Typography variant="body1">Latest run</Typography>
      <Button>Run</Button>
    </Box>
  );
}
`;

/** Create a throwaway MUI-shaped app; returns its absolute path. */
function makeFixture() {
  const dir = mkdtempSync(join(tmpdir(), "brand-ui-migrate-"));
  writeFileSync(
    join(dir, "package.json"),
    JSON.stringify(
      {
        name: "mui-fixture-app",
        dependencies: {
          react: "19",
          "@mui/material": "6",
          "@emotion/react": "11",
          vite: "5",
        },
      },
      null,
      2,
    ),
  );
  mkdirSync(join(dir, "src"));
  writeFileSync(join(dir, "src", "App.tsx"), APP_TSX);
  writeFileSync(join(dir, "src", "Panel.tsx"), PANEL_TSX);
  return dir;
}

/** A content-addressed snapshot of a directory tree: `relPath -> sha256`. */
function snapshot(dir, base = dir, acc = {}) {
  for (const entry of readdirSync(dir, { withFileTypes: true }).sort((a, b) =>
    a.name.localeCompare(b.name),
  )) {
    const abs = join(dir, entry.name);
    if (entry.isDirectory()) snapshot(abs, base, acc);
    else acc[abs.slice(base.length)] = createHash("sha256").update(readFileSync(abs)).digest("hex");
  }
  return acc;
}

// ---- scan ------------------------------------------------------------------

test("scan: profiles a MUI app with per-file usage, prop usage and the import graph", () => {
  const dir = makeFixture();
  try {
    const r = scanRepo(dir);
    assert.equal(r.status, "ok");
    assert.equal(r.project, "mui-fixture-app");
    assert.equal(r.framework, "vite");
    assert.equal(r.uiLibrary.primary, "mui");
    assert.equal(r.styling.primary, "emotion");
    assert.equal(r.components.filesScanned, 2);

    // per-tag totals + file spread
    const button = r.components.top.find((c) => c.name === "Button");
    assert.equal(button.count, 3, "Button used three times");
    assert.equal(button.files, 2, "…across two files");

    // per-file usage
    assert.ok(Array.isArray(r.components.byFile) && r.components.byFile.length, "byFile populated");
    const appButton = r.components.byFile.find(
      (x) => x.tag === "Button" && x.file.endsWith("App.tsx"),
    );
    assert.equal(appButton.count, 2, "two Buttons in App.tsx");
    for (const row of r.components.byFile)
      assert.ok(!row.file.startsWith("/"), "paths are relative");

    // prop-level usage
    assert.deepEqual(r.components.props.Typography, ["component", "variant"]);
    assert.ok(r.components.props.Button.includes("color"));

    // import graph
    const mui = r.imports.sources.find((i) => i.source === "@mui/material");
    assert.deepEqual(mui.specifiers, ["Box", "Button", "Stack", "Typography"]);
    assert.equal(mui.files, 2);
    assert.ok(r.imports.sources.some((i) => i.source === "react"));

    // token debt (reuses the audit rule set — one source of truth)
    assert.ok(r.tokens.hardcodedColors >= 1, "the #3366ff literal is counted");
    assert.ok(r.tokens.hardcodedSpacing >= 1, "p-[12px] is counted");
    assert.ok(r.tokens.fontSizes >= 1, "text-[13px] is counted");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// ---- map -------------------------------------------------------------------

test("map: reaches every verdict — props, compose, drop, direct, gap", () => {
  const dir = makeFixture();
  try {
    const scan = scanRepo(dir);
    const r = mapComponents(scan, { root });
    assert.equal(r.status, "ok");
    const by = (name) => r.mappings.find((m) => m.source === name);

    assert.equal(by("Typography").class, "props", "an aliased component with a different API");
    assert.equal(by("Typography").target, "Text");
    assert.equal(by("Typography").propRemap.variant, "role");

    assert.equal(by("Box").class, "compose", "no single equivalent");
    assert.ok(by("Box").compose.length);

    assert.equal(by("Fragment").class, "drop", "a language construct, not UI");

    assert.equal(by("Button").class, "direct", "an exact manifest match");
    assert.equal(by("Button").target, "Button");
    assert.ok(by("Button").pkg.startsWith("@elabs/"));
    assert.deepEqual(by("Button").unknownProps, ["color"], "reported, not a downgrade");

    assert.equal(by("ZzUnknown").class, "gap");
    assert.equal(by("ZzUnknown").target, null);

    // every class in the summary, plus the coverage estimate
    for (const cls of ["direct", "props", "compose", "gap", "drop"])
      assert.equal(typeof r.summary[cls], "number", `${cls} counted`);
    assert.equal(typeof r.summary.coveragePct, "number");
    assert.ok(r.summary.coveragePct > 0 && r.summary.coveragePct <= 100);
    assert.equal(
      r.summary.coverage.totalUsages,
      r.mappings.reduce((a, m) => a + m.count, 0),
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("map: risk and effort vary with usage count and file spread", () => {
  // The documented matrix: blast = usages × distinct files.
  assert.deepEqual(scoreMapping("direct", 1, 1), { risk: "low", effort: "low", blast: 1 });
  assert.equal(scoreMapping("direct", 20, 3).risk, "medium", "a wide rename is medium risk");
  assert.equal(scoreMapping("direct", 20, 3).effort, "medium", "…and medium effort at blast ≥ 40");
  assert.equal(scoreMapping("direct", 500, 40).risk, "medium", "a rename never reads as high risk");
  assert.equal(scoreMapping("gap", 1, 1).risk, "medium", "a gap never reads as low risk");
  assert.equal(scoreMapping("gap", 50, 10).risk, "high");
  assert.equal(scoreMapping("props", 2, 1).effort, "medium");
  assert.equal(scoreMapping("drop", 999, 99).effort, "low", "dropping non-UI is always cheap");
});

test("SOURCE_ALIASES is a well-formed data table", () => {
  assert.ok(SOURCE_ALIASES.length > 10, "meaningful coverage");
  for (const a of SOURCE_ALIASES) {
    assert.ok(a.from, "every row names a source component");
    assert.ok(["props", "compose", "drop"].includes(a.class), `${a.from}: reachable class`);
    if (a.class === "props") assert.ok(a.to, `${a.from}: a props row names its target`);
    if (a.class === "compose") assert.ok(a.compose?.length, `${a.from}: a compose row lists parts`);
  }
});

// ---- migration deliverables ------------------------------------------------

test("renderMigrationDocs: three markdown docs naming the app and the phases", () => {
  const dir = makeFixture();
  try {
    const scan = scanRepo(dir);
    const map = mapComponents(scan, { root });
    const docs = renderMigrationDocs(scan, map);

    assert.deepEqual(Object.keys(docs).sort(), [...MIGRATION_DOCS].sort());
    for (const name of MIGRATION_DOCS) {
      assert.ok(docs[name].length > 200, `${name} is a real document`);
      assert.ok(docs[name].startsWith("# "), `${name} opens with a heading`);
      assert.match(docs[name], /mui-fixture-app/, `${name} names the app`);
    }
    // the profile carries the stack + the inventory
    assert.match(docs["repo-profile.md"], /\| Framework \| vite \|/);
    assert.match(docs["repo-profile.md"], /Typography/);
    // the analysis carries the coverage number + every verdict section
    assert.match(docs["analysis.md"], new RegExp(`\\*\\*${map.summary.coveragePct}%\\*\\*`));
    for (const cls of ["direct", "props", "compose", "gap", "drop"])
      assert.ok(docs["analysis.md"].includes(`## ${cls}`), `analysis has a ${cls} section`);
    // the plan carries every strangler-fig phase, in order
    let cursor = -1;
    for (const phase of MIGRATION_PHASES) {
      const at = docs["plan.md"].indexOf(phase.name);
      assert.ok(at > cursor, `plan lists "${phase.name}" in order`);
      cursor = at;
    }
    assert.match(docs["plan.md"], /Button/, "the plan names the components per phase");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("renderMigrationDocs: scan-only input renders the profile alone", () => {
  const dir = makeFixture();
  try {
    const docs = renderMigrationDocs(scanRepo(dir));
    assert.deepEqual(Object.keys(docs), ["repo-profile.md"]);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// ---- the read-only guarantee ----------------------------------------------

test("scan + map + render never touch the scanned project", () => {
  const dir = makeFixture();
  try {
    const before = snapshot(dir);
    const scan = scanRepo(dir);
    const map = mapComponents(scan, { root });
    renderMigrationDocs(scan, map);
    const after = snapshot(dir);
    assert.deepEqual(after, before, "no file added, removed or modified");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// ---- the source scanners (documented heuristics) ---------------------------

test("scanJsxTags: reads attribute names at depth 0 only", () => {
  const tags = scanJsxTags(
    `<Card title="x" onClick={() => (a = 1)} data-slot="card">\n  <Inner />\n</Card>`,
  );
  assert.deepEqual(
    tags.map((t) => t.tag),
    ["Card", "Inner"],
  );
  assert.deepEqual(tags[0].props, ["title", "onClick", "data-slot"]);
  assert.deepEqual(tags[1].props, []);
});

test("scanImports: default, named, aliased, namespace and side-effect clauses", () => {
  const rows = scanImports(
    `import React from "react";\n` +
      `import { a, b as c } from "./mod";\n` +
      `import * as ns from "pkg";\n` +
      `import "./styles.css";\n`,
  );
  assert.deepEqual(rows[0], { source: "react", specifiers: ["React"] });
  assert.deepEqual(rows[1], { source: "./mod", specifiers: ["a", "b"] });
  assert.deepEqual(rows[2], { source: "pkg", specifiers: ["ns"] });
  assert.deepEqual(rows[3], { source: "./styles.css", specifiers: [] });
});
