#!/usr/bin/env node
/**
 * run.mjs — the single `check` runner: every product convention is a rule in
 * scripts/check/rules/*.mjs, run in one process over one shared repo context, plus the
 * few external checks in scripts/check/commands.mjs, spawned in parallel after the rules.
 *
 *   node scripts/check/run.mjs                      run all rules + external commands
 *     --rule a,b          only these rule / command ids
 *     --scope s           only rules of this scope (no commands)
 *     --verbose           also print findings of passing rules (+ timings)
 *     --json              machine-readable result on stdout
 *     --list              id, scope, baseline, doc
 *     --update-baseline   record current results (ratchet down) [--force to raise]
 *     --test              every rule's fixtures + every scripts/**\/*.test.mjs self-test
 *     --docs [--check]    render rule docs into docs/GATES.md
 *
 * Test seams (used by run.test.mjs): --root, --rules-dir, --baseline-file, --conventions,
 * --commands-file. With --rules-dir and no --commands-file, no commands run, and --test
 * runs only that dir's fixtures.
 * Contract and porting guide: scripts/check/README.md. Dependency-free; ESM.
 */
import { spawn } from "node:child_process";
import { existsSync, readFileSync, readdirSync, realpathSync, writeFileSync } from "node:fs";
import { availableParallelism } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import {
  BASELINE_PATH,
  evaluate,
  nextEntry,
  raises,
  readBaseline,
  writeBaseline,
} from "./baseline.mjs";
import { COMMANDS } from "./commands.mjs";
import { createFsContext, createMemoryContext } from "./context.mjs";
import { RULES_DIR, SCOPES, loadRules, runnerFor, validateRules } from "./registry.mjs";

const REPO_ROOT = dirname(dirname(dirname(fileURLToPath(import.meta.url))));
export const RULE_DOCS_PATH = join(REPO_ROOT, "docs", "GATES.md");
export const DOCS_START = "<!-- brand-ui:gen:check-rules:start -->";
export const DOCS_END = "<!-- brand-ui:gen:check-rules:end -->";
const FINDINGS_CAP = 50;
const OUTPUT_TAIL = 40;

export function parseArgs(argv) {
  const o = { rules: [], scope: null, update: false, force: false, test: false, docs: false };
  const list = (v) =>
    String(v ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  const value = (a, i) =>
    a.includes("=") ? [a.slice(a.indexOf("=") + 1), i] : [argv[i + 1], i + 1];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const flag = a.split("=")[0];
    let v;
    switch (flag) {
      case "--rule":
        [v, i] = value(a, i);
        o.rules.push(...list(v));
        break;
      case "--scope":
        [o.scope, i] = value(a, i);
        break;
      case "--root":
        [o.root, i] = value(a, i);
        break;
      case "--rules-dir":
        [o.rulesDir, i] = value(a, i);
        break;
      case "--baseline-file":
        [o.baselinePath, i] = value(a, i);
        break;
      case "--conventions":
        [o.conventionsPath, i] = value(a, i);
        break;
      case "--commands-file":
        [o.commandsFile, i] = value(a, i);
        break;
      case "--update-baseline":
        o.update = true;
        break;
      case "--force":
        o.force = true;
        break;
      case "--test":
        o.test = true;
        break;
      case "--docs":
        o.docs = true;
        break;
      case "--check":
        o.check = true;
        break;
      case "--json":
        o.json = true;
        break;
      case "--list":
        o.list = true;
        break;
      case "--verbose":
        o.verbose = true;
        break;
      default:
        throw new Error(`unknown argument ${a}`);
    }
  }
  if (o.scope && !SCOPES.includes(o.scope))
    throw new Error(`--scope must be one of ${SCOPES.join(", ")}`);
  if (o.force && !o.update) throw new Error("--force only applies to --update-baseline");
  if (o.check && !o.docs) throw new Error("--check only applies to --docs");
  return o;
}

// ─────────────────────────────── running ──────────────────────────────────────

/** Run rules concurrently against one ctx → `[{ rule, findings, error, ms }]` (input order). */
export async function runRules(rules, ctx) {
  return Promise.all(
    rules.map(async (rule) => {
      const started = Date.now();
      try {
        const findings = (await runnerFor(rule)(ctx)) ?? [];
        if (!Array.isArray(findings)) throw new Error("run(ctx) must return an array of findings");
        return { rule, findings, error: null, ms: Date.now() - started };
      } catch (error) {
        return { rule, findings: [], error, ms: Date.now() - started };
      }
    }),
  );
}

/**
 * Fixture problems for one rule (empty = every fail fixture breaks its baseline, every pass
 * fixture keeps it). A fixture's baseline is its optional `baseline` entry, else empty — so
 * for an unweighted rule "pass" means 0 findings and "fail" means ≥ 1.
 */
export async function checkFixtures(rule) {
  const problems = [];
  const run = runnerFor(rule);
  for (const [kind, list] of [
    ["pass", rule.fixtures?.pass ?? []],
    ["fail", rule.fixtures?.fail ?? []],
  ]) {
    for (let i = 0; i < list.length; i++) {
      try {
        const findings = ((await run(createMemoryContext(list[i].files))) ?? []).filter(
          (f) => !f.warn,
        );
        const { ok, failing } = evaluate(rule, findings, list[i].baseline);
        if (kind === "pass" && !ok)
          problems.push(
            `${rule.id}: fixtures.pass[${i}] yielded ${failing.length} finding(s): ${failing[0]?.msg}`,
          );
        if (kind === "fail" && ok)
          problems.push(`${rule.id}: fixtures.fail[${i}] yielded 0 findings`);
      } catch (err) {
        problems.push(`${rule.id}: fixtures.${kind}[${i}] threw: ${err.message}`);
      }
    }
  }
  return problems;
}

/** A child's env: without NODE_TEST_CONTEXT, which makes a nested `node --test` refuse to run. */
function childEnv() {
  const env = { ...process.env };
  delete env.NODE_TEST_CONTEXT;
  return env;
}

/** Spawn one external command with captured output. Never throws → `{ code, output, ms }`. */
function spawnCaptured(argv, cwd) {
  return new Promise((done) => {
    const started = Date.now();
    const chunks = [];
    const [cmd, ...args] = argv;
    let child;
    try {
      child = spawn(cmd === "node" ? process.execPath : cmd, args, {
        cwd,
        env: childEnv(),
        stdio: ["ignore", "pipe", "pipe"],
        shell: process.platform === "win32",
      });
    } catch (err) {
      done({ code: 1, output: String(err?.message ?? err), ms: 0 });
      return;
    }
    child.stdout.on("data", (d) => chunks.push(d));
    child.stderr.on("data", (d) => chunks.push(d));
    child.on("error", (err) => chunks.push(Buffer.from(`\n${err.message}\n`)));
    child.on("close", (code, signal) =>
      done({
        code: code ?? (signal ? 1 : 0),
        output: Buffer.concat(chunks).toString("utf8"),
        ms: Date.now() - started,
      }),
    );
  });
}

/** Run external commands in parallel → `[{ command, ok, code, output, ms }]` (input order). */
export async function runCommands(commands, root) {
  return Promise.all(
    commands.map(async (command) => {
      const r = await spawnCaptured(command.cmd, root);
      return { command, ok: r.code === 0, ...r };
    }),
  );
}

async function loadCommands(o) {
  if (o.commandsFile) {
    const mod = await import(pathToFileURL(resolve(o.commandsFile)).href);
    return mod.COMMANDS ?? mod.default ?? [];
  }
  return o.rulesDir ? [] : COMMANDS;
}

const byLocation = (a, b) => a.file.localeCompare(b.file) || (a.line ?? 0) - (b.line ?? 0);

function printFindings(log, findings) {
  const sorted = [...findings].sort(byLocation);
  for (const f of sorted.slice(0, FINDINGS_CAP))
    log(`    ${f.file}:${f.line ?? 1}  ${f.warn ? "(advisory) " : ""}${f.msg}`);
  if (sorted.length > FINDINGS_CAP) log(`    …and ${sorted.length - FINDINGS_CAP} more`);
}

// ──────────────────────────────── docs ────────────────────────────────────────

export function renderDocs(rules, commands = []) {
  const lines = [
    DOCS_START,
    "",
    "## Checked conventions",
    "",
    "Generated from `scripts/check/rules/*.mjs` and `scripts/check/commands.mjs` (`pnpm gen`). Edit a rule's `doc`, never this block; `pnpm check` enforces each line.",
  ];
  for (const scope of SCOPES) {
    const inScope = rules.filter((r) => r.scope === scope).sort((a, b) => a.id.localeCompare(b.id));
    if (inScope.length === 0) continue;
    lines.push("", `### ${scope[0].toUpperCase()}${scope.slice(1)}`, "");
    for (const r of inScope) lines.push(`- ${r.doc.trim()} (\`${r.id}\`)`);
  }
  if (commands.length) {
    lines.push("", "### External commands", "");
    for (const c of [...commands].sort((a, b) => a.id.localeCompare(b.id)))
      lines.push(`- ${c.doc.trim()} (\`${c.id}\`: \`${c.cmd.join(" ")}\`)`);
  }
  lines.push("", DOCS_END);
  return lines.join("\n");
}

/** Replace the marker region, or append it when the markers are absent. */
export function applyDocs(text, block) {
  const s = text.indexOf(DOCS_START);
  const e = text.indexOf(DOCS_END);
  if (s !== -1 && e > s) return text.slice(0, s) + block + text.slice(e + DOCS_END.length);
  return `${text.replace(/\s*$/, "")}\n\n${block}\n`;
}

// ──────────────────────────────── main ────────────────────────────────────────

export async function main(argv = [], { log = console.log, error = console.error } = {}) {
  let o;
  try {
    o = parseArgs(argv);
  } catch (err) {
    error(`✖ check: ${err.message}`);
    return 2;
  }
  const root = o.root ? resolve(o.root) : REPO_ROOT;
  const baselinePath = o.baselinePath ? resolve(o.baselinePath) : BASELINE_PATH;
  const conventionsPath = o.conventionsPath ? resolve(o.conventionsPath) : RULE_DOCS_PATH;
  const loaded = await loadRules(o.rulesDir ? resolve(o.rulesDir) : RULES_DIR);
  const all = loaded.map((l) => l.rule);

  if (o.test) {
    // A seam rules dir tests only its fixtures; the real repo runs every self-test file,
    // which includes the fixtures of every rule (scripts/check/fixtures.test.mjs).
    if (o.rulesDir) return registerTests(loaded, readBaseline(baselinePath));
    return runSelfTests(root, { log, error });
  }
  const commands = await loadCommands(o);

  const shapeErrors = validateRules(loaded);
  if (shapeErrors.length) {
    for (const e of shapeErrors) error(`✖ ${e}`);
    return 1;
  }

  if (o.docs) {
    const current = existsSync(conventionsPath) ? readFileSync(conventionsPath, "utf8") : "";
    const next = applyDocs(current, renderDocs(all, commands));
    if (o.check) {
      if (next !== current) {
        error(`✖ check --docs: ${conventionsPath} is stale — run \`pnpm gen\`.`);
        return 1;
      }
      log("✔ check --docs: the rule catalogue is up to date.");
      return 0;
    }
    if (next !== current) writeFileSync(conventionsPath, next);
    log(`✔ check --docs: ${next === current ? "unchanged" : "wrote"} ${conventionsPath}`);
    return 0;
  }

  const known = (id) => all.some((r) => r.id === id) || commands.some((c) => c.id === id);
  const unknown = o.rules.filter((id) => !known(id));
  if (unknown.length) {
    error(`✖ check: unknown rule id(s): ${unknown.join(", ")}`);
    return 2;
  }
  const selected = all.filter(
    (r) => (o.rules.length === 0 || o.rules.includes(r.id)) && (!o.scope || r.scope === o.scope),
  );
  // Commands run with no filter, or when --rule names them; never under --scope or --update.
  const selectedCommands =
    o.scope || o.update ? [] : commands.filter((c) => !o.rules.length || o.rules.includes(c.id));
  const baseline = readBaseline(baselinePath);

  if (o.list) {
    for (const r of selected) {
      const e = baseline[r.id];
      const size =
        r.baseline === "none" ? "0" : typeof e === "number" ? e : Object.keys(e ?? {}).length;
      log(`${r.id}\t${r.scope}\t${r.baseline}:${size}\t${r.doc}`);
    }
    for (const c of selectedCommands) log(`${c.id}\tcommand\t${c.cmd.join(" ")}\t${c.doc}`);
    return 0;
  }

  const started = Date.now();
  const results = await runRules(selected, createFsContext(root));

  if (o.update) return updateBaseline(results, baseline, baselinePath, o.force, { log, error });

  let failed = 0;
  const report = [];
  for (const res of results) {
    const { rule, findings, error: err, ms } = res;
    if (err) {
      failed++;
      report.push({ id: rule.id, ok: false, error: String(err.stack ?? err) });
      if (!o.json) error(`✖ ${rule.id}: threw — ${err.message}`);
      continue;
    }
    const ev = evaluate(rule, findings, baseline[rule.id]);
    const advisory = findings.filter((f) => f.warn).length;
    report.push({ id: rule.id, scope: rule.scope, ...ev, advisory, findings });
    if (!ev.ok) failed++;
    if (o.json) continue;
    const extra = `${advisory ? ` · ${advisory} advisory` : ""}${o.verbose ? ` · ${ms}ms` : ""}`;
    log(`${ev.ok ? "✔" : "✖"} ${rule.id}: ${ev.count} findings (baseline ${ev.allowed})${extra}`);
    if (!ev.ok) printFindings(log, ev.failing);
    else if (o.verbose && findings.length) printFindings(log, findings);
    if (ev.ok && rule.baseline !== "none" && ev.count < ev.allowed)
      log(`    ↓ below baseline — ratchet with \`pnpm check:update --rule ${rule.id}\``);
  }
  const commandResults = await runCommands(selectedCommands, root);
  const commandReport = [];
  for (const { command, ok, code, output, ms } of commandResults) {
    if (!ok) failed++;
    commandReport.push({ id: command.id, kind: "command", ok, code, ms, output });
    if (o.json) continue;
    log(`${ok ? "✔" : "✖"} ${command.id}: exit ${code}${o.verbose ? ` · ${ms}ms` : ""}`);
    if (!ok) {
      const lines = output.trimEnd().split(/\r?\n/);
      if (lines.length > OUTPUT_TAIL) log(`    …${lines.length - OUTPUT_TAIL} earlier line(s)`);
      for (const l of lines.slice(-OUTPUT_TAIL)) log(`    ${l}`);
      log(`    rerun: ${command.cmd.join(" ")}`);
    }
  }
  const total = results.length + commandResults.length;
  if (o.json) {
    log(
      JSON.stringify(
        {
          ok: failed === 0,
          rules: report.map(({ failing, ...r }) => r),
          commands: commandReport,
        },
        null,
        2,
      ),
    );
  } else {
    const what = commandResults.length
      ? `pass (${results.length} rules + ${commandResults.length} commands, ${Date.now() - started}ms)`
      : `rules pass (${Date.now() - started}ms)`;
    log(`${failed ? "✖" : "✔"} check: ${total - failed}/${total} ${what}`);
  }
  return failed ? 1 : 0;
}

function updateBaseline(results, baseline, baselinePath, force, { log, error }) {
  const next = { ...baseline };
  const refusals = [];
  for (const { rule, findings, error: err } of results) {
    if (err) {
      refusals.push(`${rule.id}: threw — ${err.message}`);
      continue;
    }
    if (rule.baseline === "none") continue;
    const entry = nextEntry(rule, findings);
    const up = raises(rule, baseline[rule.id], entry);
    if (up.length && !force)
      refusals.push(
        `${rule.id}: would RAISE the baseline\n${up.map((l) => `    ${l}`).join("\n")}`,
      );
    next[rule.id] = entry;
  }
  if (refusals.length) {
    for (const r of refusals) error(`✖ ${r}`);
    error(
      "✖ check --update-baseline: nothing written. The ratchet only goes down; pass --force if justified.",
    );
    return 1;
  }
  writeBaseline(next, baselinePath);
  log(`✔ check --update-baseline: wrote ${results.length} rule(s) to ${baselinePath}`);
  return 0;
}

/** Self-tests that stage into the REAL git index: run last, alone (see the test file). */
export const SERIAL_SELFTESTS = ["scripts/check-package-json-dep-moves.test.mjs"];

/** Every `scripts/**\/*.test.mjs` (repo-relative, sorted), split into parallel and serial. */
export function selfTestFiles(root = REPO_ROOT) {
  const found = [];
  const walk = (rel) => {
    for (const ent of readdirSync(join(root, rel), { withFileTypes: true })) {
      if (ent.name === "node_modules" || ent.name.startsWith(".")) continue;
      const child = `${rel}/${ent.name}`;
      if (ent.isDirectory()) walk(child);
      else if (ent.isFile() && ent.name.endsWith(".test.mjs")) found.push(child);
    }
  };
  if (existsSync(join(root, "scripts"))) walk("scripts");
  found.sort();
  return {
    parallel: found.filter((f) => !SERIAL_SELFTESTS.includes(f)),
    serial: found.filter((f) => SERIAL_SELFTESTS.includes(f)),
  };
}

/**
 * `--test` on the real repo: every self-test file through node:test's `run()` — the
 * parallel batch first, then the serial files one at a time — with the spec reporter on
 * stdout and one total line at the end.
 */
async function runSelfTests(root, { log, error }) {
  const { parallel, serial } = selfTestFiles(root);
  // run() refuses to start when it thinks it is inside a test file (this env var).
  delete process.env.NODE_TEST_CONTEXT;
  if (process.cwd() !== root) process.chdir(root);
  const { run } = await import("node:test");
  const { spec } = await import("node:test/reporters");
  const counts = { pass: 0, fail: 0, skip: 0 };
  const failedFiles = new Set();
  const started = Date.now();
  const count = (kind) => (data) => {
    if (data.details?.type === "suite") return;
    if (kind === "fail") {
      counts.fail++;
      if (data.file) failedFiles.add(relative(root, data.file));
    } else if (data.skip || data.todo) counts.skip++;
    else counts.pass++;
  };
  const concurrency = Math.min(8, availableParallelism());
  for (const [files, conc] of [
    [parallel, concurrency],
    [serial, 1],
  ]) {
    if (!files.length) continue;
    const stream = run({ files: files.map((f) => join(root, f)), concurrency: conc });
    stream.on("test:pass", count("pass"));
    stream.on("test:fail", count("fail"));
    const reporter = /^class\b/.test(Function.prototype.toString.call(spec)) ? new spec() : spec;
    await new Promise((done, fail) => {
      const out = stream.compose(reporter);
      out.on("data", (chunk) => process.stdout.write(chunk));
      out.on("end", done);
      out.on("error", fail);
    });
  }
  const files = parallel.length + serial.length;
  const summary = `${counts.pass + counts.fail + counts.skip} tests in ${files} files: ${counts.pass} pass, ${counts.fail} fail, ${counts.skip} skipped (${Math.round((Date.now() - started) / 1000)}s)`;
  if (counts.fail) {
    error(`✖ check --test: ${summary}`);
    error(`  failing files: ${[...failedFiles].sort().join(", ") || "(unknown)"}`);
    return 1;
  }
  log(`✔ check --test: ${summary}`);
  return 0;
}

/** `--test` with a seam rules dir: register node:test cases; node reports and sets the exit code. */
export async function registerTests(loaded, baseline) {
  const { test } = await import("node:test");
  const { default: assert } = await import("node:assert/strict");
  const ids = new Set(loaded.map((l) => l.rule?.id));
  test("rule shapes are valid and ids unique", () => {
    assert.deepEqual(validateRules(loaded), []);
  });
  test("baseline.json only names known, baselined rules", () => {
    const problems = Object.keys(baseline)
      .filter((id) => !ids.has(id) || loaded.find((l) => l.rule.id === id).rule.baseline === "none")
      .map((id) => `${id}: orphan or "none" rule in baseline.json`);
    assert.deepEqual(problems, []);
  });
  for (const { rule } of loaded) {
    test(`fixtures: ${rule?.id}`, async () => {
      assert.deepEqual(await checkFixtures(rule), []);
    });
  }
  return null;
}

function isEntryPoint() {
  if (!process.argv[1]) return false;
  const real = (p) => {
    try {
      return realpathSync(p);
    } catch {
      return resolve(p);
    }
  };
  return real(fileURLToPath(import.meta.url)) === real(process.argv[1]);
}

if (isEntryPoint()) {
  main(process.argv.slice(2)).then((code) => {
    if (typeof code === "number") process.exitCode = code;
  });
}
