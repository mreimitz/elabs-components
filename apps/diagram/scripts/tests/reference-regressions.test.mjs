/** Run directly: node --test scripts/tests/reference-regressions.test.mjs (from apps/diagram). */
import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { runnerImport } from "vite";
import { readAll } from "../../server/catalog-fs.mjs";

const root = fileURLToPath(new URL("../../", import.meta.url));
const { module: api } = await runnerImport(join(root, "src/server-surface.ts"), {
  root,
  configFile: false,
  logLevel: "error",
});
const entries = (await readAll(api.ICON_NAMES)).entries;
const catalog = api.catalogLookupOf(entries);
const drawing = (text) => {
  const checked = api.checkDiagram(text, entries);
  assert.equal(checked.ok, true, JSON.stringify(checked.issues));
  return JSON.parse(
    JSON.stringify(checked.spec, (key, value) => (key === "catalogEntry" ? undefined : value)),
  );
};
const fixtures = {
  alias:
    'diagram: "1"\nx-names: &glue AWS Glue\nnodes:\n  - id: a\n    icon: aws/glue\n    title: *glue\n',
  anchor:
    'diagram: "1"\nnodes:\n  - id: a\n    icon: clickhouse/cloud\n    title: ClickHouse Cloud\n    type: datastore\n    subtitle: Cloud\n    badges: &b [managed]\n  - id: b\n    icon: aws/glue\n    badges: *b\n',
  icon: 'diagram: "1"\nnodes:\n  - id: a\n    icon: generic/users\n',
  flow: 'diagram: "1"\nnodes:\n  - { id: a, icon: aws/glue }\n',
  crlf: 'diagram: "1"\r\nnodes:\r\n  - id: a\r\n    icon: aws/glue\r\n',
};
for (const [name, before] of Object.entries(fixtures)) {
  test(`migration preserves compiled drawing: ${name}`, () => {
    const result = api.refFirstText(before, catalog);
    assert.equal(result.reason, undefined);
    assert.equal(result.changed, true);
    assert.deepEqual(drawing(result.text), drawing(before));
    assert.equal(api.refFirstText(result.text, catalog).text, result.text);
    if (name === "crlf") assert.equal(/(?<!\r)\n/.test(result.text), false);
    if (name === "alias") assert.match(result.text, /title: \*glue/);
    if (name === "anchor") assert.match(result.text, /badges: &b \[managed\]/);
    if (name === "icon") assert.match(result.text, /icon: generic\/users/);
  });
}
test("copied reference-first files preserve unnamed stand-ins", () => {
  const before =
    'diagram: "1"\nnodes:\n  - id: a\n    ref: catalog/aws/glue\n  - id: standin\n    icon: aws/rds # deliberately custom\n';
  assert.equal(api.refFirstText(before, catalog).text, before);
  const named = api.refFirstText(before, catalog, { standin: "aws/rds" });
  assert.equal(named.changed, true);
  assert.deepEqual(drawing(named.text), drawing(before));
});
test("migration refuses invalid drawings without returning partial edits", () => {
  const before = fixtures.flow + "  - id: b\n    type: impossible\n";
  const result = api.refFirstText(before, catalog);
  assert.equal(result.changed, false);
  assert.equal(result.text, before);
  assert.equal(result.reason, "drawing-changed");
});
test("every catalog entry preserves compiled node appearance", () => {
  for (const entry of entries.filter((item) => item.vendor !== "lucide")) {
    const supplied = api.suppliedBy(entry, catalog);
    for (const icon of new Set([entry.name, entry.icon])) {
      const node = {
        id: "a",
        icon,
        title: supplied.title ?? "a",
        type: supplied.type ?? "service",
        ...("subtitle" in supplied && { subtitle: supplied.subtitle }),
        ...("badges" in supplied && { badges: supplied.badges }),
      };
      const before = `diagram: "1"\nnodes:\n  - ${JSON.stringify(node)}\n`;
      const result = api.refFirstText(before, catalog);
      assert.equal(result.reason, undefined, `${entry.name}: ${icon}`);
      assert.deepEqual(drawing(result.text), drawing(before), `${entry.name}: ${icon}`);
    }
  }
});
test("CLI validates all files before writing any", () => {
  const dir = mkdtempSync(join(tmpdir(), "atlas-reference-"));
  try {
    const good = join(dir, "a.yaml");
    const bad = join(dir, "b.yaml");
    writeFileSync(good, fixtures.flow);
    writeFileSync(bad, 'diagram: "1"\nnodes: [');
    const run = spawnSync(process.execPath, ["scripts/upgrade-workspace.mjs", "--ref-first", dir], {
      cwd: root,
      encoding: "utf8",
    });
    assert.equal(run.status, 1, run.stdout + run.stderr);
    assert.match(run.stdout, /no files were written/);
    assert.match(run.stdout, /not written/);
    assert.equal(readFileSync(good, "utf8"), fixtures.flow);
    writeFileSync(bad, fixtures.flow);
    const choices = join(dir, "choices.json");
    writeFileSync(
      choices,
      JSON.stringify({ [relative(join(root, "workspace"), bad)]: { typo: "aws/glue" } }),
    );
    const invalid = spawnSync(
      process.execPath,
      ["scripts/upgrade-workspace.mjs", "--ref-first", "--choices", choices, dir],
      { cwd: root, encoding: "utf8" },
    );
    assert.equal(invalid.status, 1);
    assert.equal(readFileSync(good, "utf8"), fixtures.flow);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
