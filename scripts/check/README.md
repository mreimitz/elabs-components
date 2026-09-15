# `check` — one runner, one rule per convention

`node scripts/check/run.mjs` (`pnpm check`) runs every `rules/*.mjs` in one process over one shared
repo context. Flags: `--rule a,b` · `--scope s` · `--verbose` · `--json` · `--list` ·
`--update-baseline [--force]` · `--test` · `--docs [--check]`.

## Rule contract

```js
export default {
  id: "theme-parity", // kebab-case, unique; also the baseline.json key
  scope: "themes", // themes | components | stories | packages | registry | repo
  doc: "Every theme block defines every token.", // ONE line, imperative → conventions.md
  baseline: "none", // none (must be 0) | count | per-file | keys
  run(ctx) {
    return [{ file, line, msg, key, warn }];
  }, // sync or async
  fixtures: { pass: [{ files: { "rel/path": "text" } }], fail: [{ files: {} }] }, // fail ≥ 1
  eslint: undefined, // or "brand/no-raw-color": no run() needed, lints packages/*/src
};
```

A finding: `file` (repo-relative), `line` (1-based), `msg`. Optional `key` = stable identity for
`keys` baselines (default `file::msg`). Optional `warn: true` = advisory: printed, never counted.

## `ctx` — the only door to the repo

`root` · `readFile(rel)` · `exists(rel)` · `json(rel)` · `gitFiles()` (tracked + untracked, not
ignored, cached once) · `glob(patterns, { ignore })` (`**`, `*`, `?`, `{a,b}` over `gitFiles()`) ·
`themes.names()` (BUILT_IN_THEMES) · `themes.css()` (engine + every theme file; throws if
incomplete) · `packages()` → `[{ name, dir, json, distributable }]` ·
`eslint({ rules, patterns, ignore })` → findings. `lineOf(text, index)` is exported from
`context.mjs`. Never import `node:fs` in a rule: fixtures run on an in-memory ctx with the same API.

## Baselines — `baseline.json`

`{ "<id>": number | { "<file>": n } | ["<key>", …] }`, sorted. `count`: fail when N > M.
`per-file`: fail when any file's count rises (new file = 0). `keys`: fail on any key not listed.
`--update-baseline` rewrites the selected rules and refuses (writing nothing) if any would rise;
`--force` accepts. `none` rules have no entry.

## Porting a gate

1. Copy the pure detection logic into `rules/<id>.mjs`; swap `readFileSync`/`readdirSync` for
   `ctx.readFile`/`ctx.glob`. Emit one finding per violation, with a line.
2. Port the old self-test cases into `fixtures` (each `pass` → 0 findings, each `fail` → ≥ 1).
   Ratchet arithmetic tests are not needed — the runner owns them.
3. Seed `baseline.json` from the old baseline in the new shape, then prove parity: old script and
   `run.mjs --rule <id>` agree on counts, and a planted violation fails both.
4. `node scripts/check/run.mjs --test && node scripts/check/run.mjs --docs`. Leave the old script;
   the integrator removes it.

Shapes: a **list baseline** (`["pkg::Export::prop=value"]`) → `baseline: "keys"` + `key` per
finding. A `[n, m]` pair baseline → two keyed/counted findings or one rule per axis; the ratchet
must stay monotone. **Multi-file inputs** (manifest + source + stories) → read them all through
`ctx` and put every file in each fixture's `files`. **Registry warn-only** → `warn: true`.
**ESLint-backed** → `eslint: "<plugin>/<rule>"` (register the plugin prefix in `eslint.mjs`
`PLUGINS`), optionally `eslintPatterns`/`eslintIgnore`. **Gates that spawn `pnpm`, build, or hit
the network** do not belong here: keep them as scripts, or move only their pure file-reading half.
