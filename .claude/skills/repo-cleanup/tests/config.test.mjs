import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, test } from "node:test";
import {
  DEFAULT_CONFIG,
  estimateTokens,
  findRepoRoot,
  isExcluded,
  loadConfig,
  mergeConfig,
  parseYamlSubset,
} from "../scripts/config.mjs";

/** @type {string[]} */
const temps = [];
function temp() {
  const d = mkdtempSync(join(tmpdir(), "repo-cleanup-test-"));
  temps.push(d);
  return d;
}
afterEach(() => {
  while (temps.length) rmSync(temps.pop(), { recursive: true, force: true });
});

// -------------------------------------------------------------------------
// YAML subset
// -------------------------------------------------------------------------

test("parses scalars with type coercion", () => {
  const y = parseYamlSubset(`
version: 1
gate: auto
enabled: true
disabled: false
missing: null
ratio: 0.25
quoted: "pnpm test"
`);
  assert.deepEqual(y, {
    version: 1,
    gate: "auto",
    enabled: true,
    disabled: false,
    missing: null,
    ratio: 0.25,
    quoted: "pnpm test",
  });
});

test("parses inline sequences and maps", () => {
  const y = parseYamlSubset('exclude: [node_modules, dist, "out"]\nlimits: { a: 1, b: two }\n');
  assert.deepEqual(y.exclude, ["node_modules", "dist", "out"]);
  assert.deepEqual(y.limits, { a: 1, b: "two" });
});

test("parses nested block maps and block sequences", () => {
  const y = parseYamlSubset(`
audit:
  context: true
  repo: false
privacy:
  redact_secrets: true
protected_paths:
  - src/main/transport
  - resources/engine
`);
  assert.deepEqual(y.audit, { context: true, repo: false });
  assert.deepEqual(y.privacy, { redact_secrets: true });
  assert.deepEqual(y.protected_paths, ["src/main/transport", "resources/engine"]);
});

test("ignores comments and blank lines", () => {
  const y = parseYamlSubset("# leading\n\nversion: 1  # trailing\n\n# tail\n");
  assert.deepEqual(y, { version: 1 });
});

test("rejects tabs rather than guessing indentation", () => {
  assert.throws(() => parseYamlSubset("audit:\n\tcontext: true\n"), /tabs are not supported/);
});

test("rejects sequences of maps rather than half-parsing them", () => {
  assert.throws(
    () => parseYamlSubset("items:\n  - name: a\n"),
    /sequences of maps are not supported/,
  );
});

test("rejects a line that is neither key:value nor a sequence item", () => {
  assert.throws(() => parseYamlSubset("just some prose\n"), /expected 'key: value'/);
});

// -------------------------------------------------------------------------
// merge
// -------------------------------------------------------------------------

test("merge is deep for maps and replacing for arrays", () => {
  const merged = mergeConfig(DEFAULT_CONFIG, {
    exclude: ["only-this"],
    privacy: { allow_network: true },
  });
  assert.deepEqual(merged.exclude, ["only-this"], "an exclude list is a choice, not an addition");
  assert.equal(merged.privacy.allow_network, true);
  assert.equal(merged.privacy.redact_secrets, true, "untouched keys survive the merge");
  assert.equal(merged.remediation.require_clean_git, true);
});

// -------------------------------------------------------------------------
// loading
// -------------------------------------------------------------------------

test("missing config yields defaults with no warning", () => {
  const { config, source, warnings } = loadConfig(temp());
  assert.equal(source, null);
  assert.deepEqual(warnings, []);
  assert.deepEqual(config, DEFAULT_CONFIG);
});

test("a broken config falls back to defaults AND warns — never silently", () => {
  const d = temp();
  writeFileSync(join(d, ".repo-cleanup.yml"), "audit:\n\tcontext: true\n");
  const { config, source, warnings } = loadConfig(d);
  assert.equal(source, null);
  assert.equal(config, DEFAULT_CONFIG);
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /could not be parsed/);
});

test("json config is honoured and takes precedence over yml", () => {
  const d = temp();
  writeFileSync(join(d, ".repo-cleanup.json"), JSON.stringify({ gate: "make check" }));
  writeFileSync(join(d, ".repo-cleanup.yml"), "gate: never-used\n");
  const { config, source } = loadConfig(d);
  assert.equal(source, ".repo-cleanup.json");
  assert.equal(config.gate, "make check");
});

test("a future config version warns but still loads", () => {
  const d = temp();
  writeFileSync(join(d, ".repo-cleanup.json"), JSON.stringify({ version: 99, gate: "x" }));
  const { config, warnings } = loadConfig(d);
  assert.equal(config.gate, "x");
  assert.match(warnings[0], /newer than this skill understands/);
});

// -------------------------------------------------------------------------
// misc
// -------------------------------------------------------------------------

test("findRepoRoot falls back to a marker when git is absent", () => {
  const d = temp();
  writeFileSync(join(d, "package.json"), "{}");
  assert.equal(findRepoRoot(d), d);
});

test("findRepoRoot never throws on a directory with nothing in it", () => {
  const d = temp();
  assert.equal(typeof findRepoRoot(d), "string");
});

test("isExcluded matches path segments, not substrings", () => {
  const c = { exclude: ["node_modules", "dist"] };
  assert.ok(isExcluded("a/node_modules/b/c.js", c));
  assert.ok(isExcluded("dist/main.js", c));
  assert.ok(!isExcluded("src/distance.ts", c), "substring match would be a false positive");
});

test("estimateTokens is the documented chars/4 heuristic", () => {
  assert.equal(estimateTokens(4000), 1000);
  assert.equal(estimateTokens(0), 0);
});
