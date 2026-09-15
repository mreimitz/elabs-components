/**
 * lockfile-dup-keys — no duplicate sibling mapping keys in `pnpm-lock.yaml` (#201).
 * Ported from scripts/check-lockfile-dup-keys.mjs.
 *
 * A duplicate key makes `pnpm install --frozen-lockfile` fail with ERR_PNPM_BROKEN_LOCKFILE,
 * aborting CI at the install step so NO gate runs (the 7f5ead8 bad merge). A hand-rolled
 * indentation scanner, not a YAML parser: a parser would throw on the first duplicate or
 * silently apply last-key-wins. Block scalars (`|`/`>`), comments and sequence items are skipped.
 */
const LOCKFILE = "pnpm-lock.yaml";

/** Mapping key line: `  'key':` / `  "key":` / `  key:` (+ optional value). */
const KEY_RE = /^(\s*)('(?:[^']|'')*'|"(?:[^"\\]|\\.)*"|[^\s:#-][^:]*?):(?:\s|$)/;
/** Start of a block scalar value (`key: |`, `key: >-`, …). */
const BLOCK_SCALAR_RE = /:\s*[|>][+-]?\s*(?:#.*)?$/;

/** Pure: `[{ key, parent, lines }]` per key repeated among its siblings, by first line. */
export function findDuplicateLockfileKeys(yamlText) {
  const lines = yamlText.split("\n");
  const violations = [];
  const close = (scope) => {
    for (const [key, lns] of scope.seen)
      if (lns.length > 1) violations.push({ key, parent: scope.label, lines: lns });
  };
  const stack = [{ indent: -1, label: "(root)", seen: new Map() }];
  let blockScalarIndent = -1;

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    if (!raw.trim() || raw.trimStart().startsWith("#")) continue;
    const indent = raw.length - raw.trimStart().length;
    if (blockScalarIndent > -1) {
      if (indent > blockScalarIndent) continue;
      blockScalarIndent = -1;
    }
    if (raw.trimStart().startsWith("- ") || raw.trimStart() === "-") continue;
    const m = raw.match(KEY_RE);
    if (!m) continue;
    const key = m[2];
    while (stack.length > 1 && indent <= stack[stack.length - 1].indent) close(stack.pop());
    const scope = stack[stack.length - 1];
    const prev = scope.seen.get(key);
    if (prev) prev.push(i + 1);
    else scope.seen.set(key, [i + 1]);
    if (BLOCK_SCALAR_RE.test(raw)) blockScalarIndent = indent;
    else stack.push({ indent, label: key, seen: new Map() });
  }
  while (stack.length) close(stack.pop());
  return violations.sort((a, b) => a.lines[0] - b.lines[0]);
}

const lock = (...lines) => ({ files: { [LOCKFILE]: lines.join("\n") } });

export default {
  id: "lockfile-dup-keys",
  scope: "repo",
  doc: "`pnpm-lock.yaml` never repeats a sibling mapping key (a bad merge breaks `--frozen-lockfile` and silently stops CI); dedupe or regenerate with `pnpm install --lockfile-only`.",
  baseline: "none",
  run(ctx) {
    if (!ctx.exists(LOCKFILE))
      return [{ file: LOCKFILE, line: 1, msg: "pnpm-lock.yaml not found" }];
    return findDuplicateLockfileKeys(ctx.readFile(LOCKFILE)).map((v) => ({
      file: LOCKFILE,
      line: v.lines[1],
      msg: `key ${v.key} under ${v.parent} repeats (lines ${v.lines.join(", ")})`,
    }));
  },
  fixtures: {
    pass: [
      lock(
        "lockfileVersion: '9.0'",
        "packages:",
        "  '@babel/core@7.0.0':",
        "    resolution: {integrity: sha512-a}",
        "  '@babel/parser@7.0.0':",
        "    resolution: {integrity: sha512-b}",
        "snapshots:",
        "  '@babel/core@7.0.0':",
        "    dependencies:",
        "      '@babel/parser': 7.0.0",
      ),
      // same key under different parents
      lock(
        "packages:",
        "  'foo@1.0.0':",
        "    resolution: {integrity: sha512-a}",
        "snapshots:",
        "  'foo@1.0.0':",
        "    dependencies: {}",
      ),
      // block scalars, comments and sequence items cannot fake keys
      lock(
        "packages:",
        "  'a@1.0.0':",
        "    notes: |",
        "      fake:",
        "      fake:",
        "    # fake:",
        "    os:",
        "      - linux",
        "      - linux",
      ),
    ],
    fail: [
      lock(
        "packages:",
        "  '@babel/core@7.0.0':",
        "    resolution: {integrity: sha512-a}",
        "  '@babel/parser@7.0.0':",
        "    resolution: {integrity: sha512-b}",
        "  '@babel/core@7.0.0':",
        "    resolution: {integrity: sha512-a}",
      ),
      lock(
        "importers:",
        "  packages/ui:",
        "    dependencies:",
        "      react:",
        "        specifier: ^19.0.0",
        "        version: 19.0.0",
        "      react:",
        "        specifier: ^19.0.0",
        "        version: 19.0.0",
      ),
      { files: {} },
    ],
  },
};
