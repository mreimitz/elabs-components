#!/usr/bin/env node
/**
 * run-gates.mjs — run the root battery in PARALLEL and never stop at the first
 * red gate (#326).
 *
 * WHY. `.github/workflows/gates.yml` used to declare the battery as ~90
 * sequential `pnpm <gate>` lines inside `run: |` blocks, plus ~107 sequential
 * self-test lines. Both the shell and GitHub Actions abort at the first non-zero
 * exit, so ONE red gate suppressed every gate after it and a run reported one
 * failure instead of a verdict — clearing k red gates cost k CI round trips.
 * This runner discovers the gates from package.json, runs them concurrently
 * with captured output, prints one line per gate as it finishes, reports EVERY
 * failure at the end, and exits 1 if any failed.
 *
 * DISCOVERY is pure and exported (`listGates`), because the release ratchet in
 * scripts/lib/workflow-gates.mjs expands a `pnpm gates` workflow step into the
 * individual names it runs — `scripts/release-gates-baseline.json` keeps
 * recording gates, never the runner:
 *
 *   gates     = every script named `*:check`, plus GATE_EXTRAS, minus
 *               COMPOSITES (a script whose command is `pnpm <other root script>
 *               && …`, e.g. `agent-docs:check`), minus SLOW_GATES (unless
 *               --all), minus NOT_PER_CHANGE_GATES (release-path / hook-path
 *               checks that were never in the PR battery — see the map).
 *   selftests = every script named `*:test` whose command is exactly
 *               `node --test scripts/<x>.test.mjs`, minus OWN_STEP_SELFTESTS.
 *
 * Self-tests run as ONE `node:test` `run()` over every file (one process tree
 * instead of ~107 pnpm spawns), with the per-file verdict folded from the
 * runner's own events; a failed file is re-run on its own so its output can be
 * shown verbatim.
 *
 * USAGE
 *   pnpm gates                     # the per-change battery — CI runs exactly this
 *   pnpm gates --docs-only         # what CI runs on a documentation-only change
 *   pnpm gates:selftests           # every gate's own self-test
 *   pnpm gates:all                 # + the slow ones (format:check, consumer:check)
 *   node scripts/run-gates.mjs --list            # names only, one per line
 *   node scripts/run-gates.mjs --only csp,docs   # substring match, comma-separated
 *   node scripts/run-gates.mjs --skip a:check    # exact names, comma-separated
 *   node scripts/run-gates.mjs --concurrency 4   # default min(8, availableParallelism())
 *   node scripts/run-gates.mjs --root <dir>      # another package.json (the self-test)
 *
 * Dependency-free; ESM; cwd-independent.
 */
import { spawn } from "node:child_process";
import { existsSync, readFileSync, realpathSync } from "node:fs";
import { availableParallelism } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = dirname(dirname(fileURLToPath(import.meta.url)));

/** Gates whose script name does not end in `:check` but that ARE blocking gates. */
export const GATE_EXTRAS = ["registry:validate", "ai:types-only"];

/**
 * Gates that take longer than the whole rest of the battery. Skipped by default
 * and run by `--all`; in CI each keeps its own step so its time is visible.
 */
export const SLOW_GATES = new Set(["format:check", "consumer:check"]);

/**
 * `*:check` scripts that are NOT part of the per-change battery — each is a
 * release-path or git-hook-path check that needs context a PR run does not have.
 * None of them was ever listed in gates.yml; naming them here keeps discovery
 * honest instead of silently widening the battery. Name → why.
 */
export const NOT_PER_CHANGE_GATES = new Map([
  ["changelog:check", "release preflight: a feature branch correctly has no `## v<next>` heading"],
  ["dep-field-move:check", "reads the git INDEX (`--staged`); it is the pre-commit hook's check"],
  ["marketplace:check", "post-release smoke: asserts the PUBLISHED marketplace pointer"],
  ["merge:check", "needs a PR context (`gh pr` checks); run before `gh pr merge`"],
  ["release-verdict:check", "release path only: resolves the CI verdict for a tagged commit"],
]);

/**
 * Self-tests that keep their own workflow step. `ci-scope:test` guards the
 * documentation-only fast path, so it runs on EVERY CI path — including the one
 * that skips the self-test step this runner feeds.
 */
export const OWN_STEP_SELFTESTS = new Set(["ci-scope:test"]);

/**
 * Gates a documentation-only change skips (`--docs-only`, CI's fast path).
 *
 * This is exactly the union of gates.yml's former "Tokens and themes" and
 * "Component and package contracts" groups, which were the two groups guarded on
 * `steps.scope.outputs.docs_only != 'true'`: they read token CSS, component
 * source and package manifests, none of which prose can change. Everything else
 * (security, derived artifacts, docs/governance, release machinery) still runs on
 * the fast path, because prose CAN break those. Self-tests and `consumer:check`
 * are skipped on the fast path too, but they are separate steps in CI, so they
 * are not in this set. Encoded as data rather than re-derived, so the fast path
 * cannot quietly widen when a gate is added.
 */
export const DOCS_ONLY_SKIP = new Set([
  // Tokens and themes
  "tokens:check",
  "tokens:dup-blocks:check",
  "token-contract:check",
  "theme-parity:check",
  "roles:check",
  "palette:check",
  "decoration:check",
  "decoration-collapse:check",
  "surface-elevation:check",
  "elevation:check",
  "separation:check",
  "rung:check",
  "text-scale:check",
  "motion:check",
  // Component and package contracts
  "components:check",
  "data-slot:check",
  "variants:check",
  "states:check",
  "loading-states:check",
  "use-client:check",
  "dep-direction:check",
  "heavy-deps:check",
  "optional-peers:check",
  "optional-peer-types:check",
  "lucide:check",
  "charts:reuse:check",
  "charts:test-double:check",
  "chart-hairline:check",
  "process:reuse:check",
  "process:test-double:check",
  "charts:honesty:check",
  "timeline-fork:check",
  "collapse-fork:check",
  "sidebar-drift:check",
  "viewer-highlight:check",
  "microcopy:check",
  "microtypography:check",
  "intent:check",
]);

/** The one command shape a self-test may have; the capture is the test file. */
const SELFTEST_RE = /^node --test (scripts\/\S+\.test\.mjs)$/;

/**
 * A composite is a script that only chains OTHER root scripts (`pnpm a && pnpm
 * b`). Running it would run every member twice and hide which one failed.
 * `pnpm --filter <pkg> <script>` is NOT a composite — the token after `pnpm` is
 * a flag, not a root script — so `token-contract:check` stays a gate.
 */
export function isComposite(command, scripts) {
  const m = /^pnpm\s+(\S+)/.exec(String(command ?? ""));
  return Boolean(m && Object.hasOwn(scripts, m[1]));
}

/** The test file a self-test script runs, or null when it is not that shape. */
export function selfTestFile(command) {
  const m = SELFTEST_RE.exec(String(command ?? ""));
  return m ? m[1] : null;
}

/**
 * The script names the runner would run. Pure — the whole discovery rule, so
 * the workflow ratchet and the self-test see the same set the CLI does.
 *
 * @param {{ pkgJson: object, kind?: "gates"|"selftests", all?: boolean, docsOnly?: boolean }} o
 * @returns {string[]} sorted
 */
export function listGates({ pkgJson, kind = "gates", all = false, docsOnly = false }) {
  const scripts = pkgJson?.scripts ?? {};
  const names = Object.keys(scripts);
  if (kind === "selftests") {
    // CI skips the self-test step on the fast path; mirror it so a local
    // `--docs-only --selftests` run means the same thing.
    if (docsOnly) return [];
    return names
      .filter((n) => /:test$/.test(n) && selfTestFile(scripts[n]) && !OWN_STEP_SELFTESTS.has(n))
      .sort();
  }
  if (kind !== "gates") throw new Error(`listGates: unknown kind ${JSON.stringify(kind)}`);
  return names
    .filter((n) => {
      if (!(/:check$/.test(n) || GATE_EXTRAS.includes(n))) return false;
      if (isComposite(scripts[n], scripts)) return false;
      if (NOT_PER_CHANGE_GATES.has(n)) return false;
      if (!all && SLOW_GATES.has(n)) return false;
      if (docsOnly && DOCS_ONLY_SKIP.has(n)) return false;
      return true;
    })
    .sort();
}

/**
 * What each runner script expands to — the map `workflow-gates.mjs` uses so a
 * `pnpm gates` step in a workflow reads as the gates it runs.
 */
export function runnerExpansion(pkgJson) {
  return {
    gates: listGates({ pkgJson, kind: "gates" }),
    "gates:selftests": listGates({ pkgJson, kind: "selftests" }),
    "gates:all": listGates({ pkgJson, kind: "gates", all: true }),
  };
}

/** `--only a,b` keeps substring matches; `--skip a,b` drops exact names. */
export function selectGates(names, { only = [], skip = [] } = {}) {
  const skipSet = new Set(skip);
  return names.filter(
    (n) => (only.length === 0 || only.some((s) => n.includes(s))) && !skipSet.has(n),
  );
}

// ──────────────────────────────── running ─────────────────────────────────────

/** Spawn one command with captured, interleaved output. Never throws. */
function runCommand(cmd, args, { cwd, env }) {
  return new Promise((resolvePromise) => {
    const started = Date.now();
    const chunks = [];
    let child;
    try {
      child = spawn(cmd, args, {
        cwd,
        env,
        stdio: ["ignore", "pipe", "pipe"],
        shell: process.platform === "win32",
      });
    } catch (err) {
      resolvePromise({ code: 1, output: String(err?.message ?? err), ms: 0 });
      return;
    }
    child.stdout.on("data", (d) => chunks.push(d));
    child.stderr.on("data", (d) => chunks.push(d));
    child.on("error", (err) => chunks.push(Buffer.from(`\n${err.message}\n`)));
    child.on("close", (code, signal) => {
      resolvePromise({
        code: code ?? (signal ? 1 : 0),
        output: Buffer.concat(chunks).toString("utf8"),
        ms: Date.now() - started,
      });
    });
  });
}

/** Run `fn` over `items` with at most `concurrency` in flight; preserves order. */
async function pool(items, concurrency, fn) {
  const results = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i], i);
    }
  }
  const n = Math.max(1, Math.min(concurrency, items.length));
  await Promise.all(Array.from({ length: n }, worker));
  return results;
}

const mark = (ok) => (ok ? "✓" : "✗");
const secs = (ms) => `${(ms / 1000).toFixed(1)}s`;

/**
 * The environment a child gets. `NODE_TEST_CONTEXT` is dropped: node's test
 * runner sets it for its own children, and a nested `node --test` that sees it
 * refuses to run any file ("run() is being called recursively"). Without this,
 * `pnpm gates:test` (which runs this runner end to end from inside `node --test`)
 * — and any gate whose self-test spawns the runner — reads every file as "no
 * result", not as a pass or a fail.
 */
function childEnv() {
  const env = { ...process.env };
  delete env.NODE_TEST_CONTEXT;
  return env;
}

/**
 * Run every gate as `pnpm <name>` in parallel. Returns
 * `[{ name, ok, code, ms, output }]` in input order; prints one line per gate as
 * it finishes. Never stops early — that is the whole point.
 */
export async function runGates(names, { root = REPO_ROOT, concurrency, log = console.log } = {}) {
  const env = childEnv();
  return pool(names, concurrency, async (name) => {
    const r = await runCommand("pnpm", [name], { cwd: root, env });
    const ok = r.code === 0;
    log(`${mark(ok)} ${name} ${r.ms}ms`);
    return { name, ok, code: r.code, ms: r.ms, output: r.output };
  });
}

/**
 * Per-file verdicts folded from `node:test`'s `run()` event stream. Every
 * `test:pass` / `test:fail` event names the file it came from, on Node 20 and
 * 22 alike — unlike the TAP reporter, which stopped naming files at the top
 * level in Node 22. A file is ok when it produced at least one event and none
 * of them failed; a file with no events is absent from the map, and the caller
 * treats that as a failure (a crashed or never-loaded file must not read as a
 * pass). `ms` sums the top-level (nesting 0) durations of that file.
 *
 * @param {Iterable<{type: string, data: object}>} events
 * @returns {Map<string, { ok: boolean, ms: number }>}
 */
export function fileVerdicts(events) {
  const out = new Map();
  for (const ev of events) {
    if (ev.type !== "test:pass" && ev.type !== "test:fail") continue;
    const file = ev.data?.file;
    if (!file) continue;
    const cur = out.get(file) ?? { ok: true, ms: 0 };
    if (ev.type === "test:fail") cur.ok = false;
    if (ev.data.nesting === 0) cur.ms += Math.round(Number(ev.data.details?.duration_ms ?? 0));
    out.set(file, cur);
  }
  return out;
}

/**
 * Run the self-tests as ONE `node:test` `run()` over every file (one process
 * tree, `concurrency` files at a time — not ~107 pnpm spawns) and report per
 * file. Failed files are re-run one at a time so the summary can show their
 * own output verbatim.
 */
export async function runSelfTests(
  entries,
  { root = REPO_ROOT, concurrency, log = console.log } = {},
) {
  if (entries.length === 0) return [];
  // `run()` refuses to run files when it believes it is inside a test file,
  // which it decides from this env var — inherited whenever the runner itself
  // is driven from `node --test` (its own self-test does exactly that).
  delete process.env.NODE_TEST_CONTEXT;
  if (resolve(root) !== process.cwd()) process.chdir(root);
  const { run } = await import("node:test");
  // Events name files by their REAL path (a macOS tmpdir is a symlink).
  let realRoot = resolve(root);
  try {
    realRoot = realpathSync(realRoot);
  } catch {
    /* keep the resolved path */
  }
  const files = entries.map((e) => resolve(realRoot, e.file));
  const events = [];
  for await (const ev of run({ files, concurrency })) events.push(ev);
  const verdicts = fileVerdicts(events);
  const results = entries.map((e, i) => {
    const v = verdicts.get(files[i]);
    const ok = Boolean(v?.ok);
    log(`${mark(ok)} ${e.name} ${v?.ms ?? "?"}ms${v ? "" : " (no result from the runner)"}`);
    return { name: e.name, file: e.file, ok, code: ok ? 0 : 1, ms: v?.ms ?? 0, output: "" };
  });
  const env = childEnv();
  for (const f of results.filter((x) => !x.ok)) {
    const rerun = await runCommand(process.execPath, ["--test", f.file], { cwd: root, env });
    f.output = rerun.output;
    f.code = rerun.code;
    f.ms = rerun.ms;
    // A file that passes alone but failed in the shared run is still a failure
    // (it is flaky under concurrency), but say so.
    if (rerun.code === 0)
      f.output += "\n(passed when re-run alone — failed only in the concurrent run)\n";
  }
  return results;
}

/** The failure summary: every failed gate with the tail of its output. */
export function renderSummary(results, { tail = 40 } = {}) {
  const failed = results.filter((r) => !r.ok);
  const total = results.reduce((s, r) => s + r.ms, 0);
  if (failed.length === 0) {
    return `\n✔ ${results.length} passed (${secs(total)} of gate time)\n`;
  }
  const lines = [`\n── ${failed.length} of ${results.length} FAILED ──`];
  for (const r of failed) {
    lines.push(`\n✗ ${r.name} (exit ${r.code}, ${r.ms}ms)`);
    const out = r.output.trimEnd().split(/\r?\n/);
    const shown = out.slice(-tail);
    if (out.length > shown.length)
      lines.push(`    … ${out.length - shown.length} earlier line(s) omitted`);
    for (const l of shown) lines.push(`    ${l}`);
  }
  lines.push(`\n✖ ${failed.length} failed: ${failed.map((r) => r.name).join(", ")}\n`);
  return lines.join("\n");
}

// ──────────────────────────────── CLI ─────────────────────────────────────────

export function parseArgs(argv) {
  const o = { selftests: false, all: false, list: false, docsOnly: false, only: [], skip: [] };
  const list = (v) =>
    String(v ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--selftests") o.selftests = true;
    else if (a === "--all") o.all = true;
    else if (a === "--list") o.list = true;
    else if (a === "--docs-only") o.docsOnly = true;
    else if (a === "--only") o.only.push(...list(argv[++i]));
    else if (a.startsWith("--only=")) o.only.push(...list(a.slice(7)));
    else if (a === "--skip") o.skip.push(...list(argv[++i]));
    else if (a.startsWith("--skip=")) o.skip.push(...list(a.slice(7)));
    else if (a === "--concurrency") o.concurrency = Number(argv[++i]);
    else if (a.startsWith("--concurrency=")) o.concurrency = Number(a.slice(14));
    else if (a === "--root") o.root = argv[++i];
    else throw new Error(`run-gates: unknown argument ${a}`);
  }
  if (o.concurrency !== undefined && !(Number.isInteger(o.concurrency) && o.concurrency > 0)) {
    throw new Error("run-gates: --concurrency must be a positive integer");
  }
  return o;
}

export async function main(argv = [], { log = console.log } = {}) {
  let opts;
  try {
    opts = parseArgs(argv);
  } catch (err) {
    console.error(`✖ ${err.message}`);
    return 2;
  }
  const root = opts.root ? resolve(opts.root) : REPO_ROOT;
  const pkgPath = join(root, "package.json");
  if (!existsSync(pkgPath)) {
    console.error(`✖ run-gates: no package.json at ${root}`);
    return 2;
  }
  const pkgJson = JSON.parse(readFileSync(pkgPath, "utf8"));
  const kind = opts.selftests ? "selftests" : "gates";
  const names = selectGates(listGates({ pkgJson, kind, all: opts.all, docsOnly: opts.docsOnly }), {
    only: opts.only,
    skip: opts.skip,
  });
  if (opts.list) {
    for (const n of names) log(n);
    return 0;
  }
  if (names.length === 0) {
    log(`• run-gates: nothing to run (${kind}${opts.docsOnly ? ", --docs-only" : ""}).`);
    return 0;
  }
  const concurrency = opts.concurrency ?? Math.min(8, availableParallelism());
  log(
    `▶ run-gates: ${names.length} ${kind} · concurrency ${concurrency}${opts.docsOnly ? " · --docs-only" : ""}`,
  );
  const started = Date.now();
  let results;
  if (kind === "selftests") {
    const entries = names.map((n) => ({ name: n, file: selfTestFile(pkgJson.scripts[n]) }));
    results = await runSelfTests(entries, { root, concurrency, log });
  } else {
    results = await runGates(names, { root, concurrency, log });
  }
  log(renderSummary(results));
  log(`wall time ${secs(Date.now() - started)}`);
  return results.some((r) => !r.ok) ? 1 : 0;
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  main(process.argv.slice(2)).then((code) => process.exit(code));
}
