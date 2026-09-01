// search-templates.test.mjs — locks #89: `brand-ui search <query>` (and the
// `mcp__brand-ui__search` MCP tool built on the same engine) has three arms —
// components/hooks, registry items, playbooks — but no arm ever reads
// `manifest.templates`. Two of the eight shipped whole-screen templates,
// `screen-states` and `object-detail-hub`, have no corresponding
// `docs/playbooks/<name>.md` file, so `matchPlaybooks()` never sees them and
// they are completely unreachable from `search` — not even by their own exact
// name. This file asserts a real, dedicated `matchTemplates()` arm makes every
// shipped template findable, against the REAL committed manifest (never a
// fixture that could drift from `docs/playbooks/templates/index.json`).
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { findRepoRoot, generateManifest, matchTemplates } from "../lib/core.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const bin = join(here, "..", "bin", "brand-ui.mjs");
const repoRoot = findRepoRoot(here);

function run(args) {
  return spawnSync(process.execPath, [bin, ...args], {
    encoding: "utf8",
    cwd: repoRoot ?? here,
  });
}

// (a) Every shipped template must be reachable by its own exact name — the
// issue's own acceptance criterion 3. This proves a ninth template can't ship
// invisible: it is asserted against `manifest.templates`, generated fresh from
// the real `docs/playbooks/templates/index.json`, not a hand-written fixture.
test("matchTemplates: every manifest.templates entry is reachable by its own name", (t) => {
  if (!repoRoot) return t.skip("not inside the monorepo — manifest generation unavailable");
  const manifest = generateManifest(repoRoot);
  assert.ok(
    Array.isArray(manifest.templates) && manifest.templates.length > 0,
    "the real manifest carries a non-empty templates array",
  );
  for (const tmpl of manifest.templates) {
    const hits = matchTemplates(manifest, tmpl.name);
    assert.ok(
      hits.some((h) => h.name === tmpl.name),
      `matchTemplates("${tmpl.name}") returns a hit for itself`,
    );
  }
});

// (b) CLI-level: the two templates with no playbook counterpart must surface
// through a real `brand-ui search` invocation, path to source file included.
test("`brand-ui search screen-states` returns the template with its source file", (t) => {
  if (!repoRoot) return t.skip("not inside the monorepo — manifest unavailable");
  const res = run(["search", "screen-states"]);
  assert.equal(res.status, 0, `search exited cleanly:\n${res.stderr}`);
  assert.match(res.stdout, /Templates matching/, "a Templates section is printed");
  assert.match(
    res.stdout,
    /templates\/screen-states\.tsx/,
    "the template's source file path is printed",
  );
});

test("`brand-ui search object-detail-hub` returns the template with its source file", (t) => {
  if (!repoRoot) return t.skip("not inside the monorepo — manifest unavailable");
  const res = run(["search", "object-detail-hub"]);
  assert.equal(res.status, 0, `search exited cleanly:\n${res.stderr}`);
  assert.match(res.stdout, /Templates matching/, "a Templates section is printed");
  assert.match(
    res.stdout,
    /templates\/object-detail-hub\.tsx/,
    "the template's source file path is printed",
  );
});

// (c) Keyword reach: token matching against title/description, not just the
// exact archetype name.
test('`brand-ui search "empty state"` reaches screen-states via description tokens', (t) => {
  if (!repoRoot) return t.skip("not inside the monorepo — manifest unavailable");
  const res = run(["search", "empty state"]);
  assert.equal(res.status, 0, `search exited cleanly:\n${res.stderr}`);
  assert.match(res.stdout, /Templates matching/, "a Templates section is printed");
  assert.match(res.stdout, /screen-states/, 'screen-states surfaces for "empty state"');
});

test('`brand-ui search "master detail"` reaches object-detail-hub via description tokens', (t) => {
  if (!repoRoot) return t.skip("not inside the monorepo — manifest unavailable");
  const res = run(["search", "master detail"]);
  assert.equal(res.status, 0, `search exited cleanly:\n${res.stderr}`);
  assert.match(res.stdout, /Templates matching/, "a Templates section is printed");
  assert.match(res.stdout, /object-detail-hub/, 'object-detail-hub surfaces for "master detail"');
});
