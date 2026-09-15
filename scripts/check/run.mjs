#!/usr/bin/env node
/**
 * run.mjs — the single `check` runner: every product convention is a rule in
 * scripts/check/rules/*.mjs, run in one process over one shared repo context.
 *
 *   node scripts/check/run.mjs                      run all rules
 *     --rule a,b          only these rule ids
 *     --scope s           only rules of this scope
 *     --verbose           also print findings of passing rules (+ timings)
 *     --json              machine-readable result on stdout
 *     --list              id, scope, baseline, doc
 *     --update-baseline   record current results (ratchet down) [--force to raise]
 *     --test              node:test: rule shape + every rule's pass/fail fixtures
 *     --docs [--check]    render rule docs into .claude/rules/conventions.md
 *
 * Test seams (used by run.test.mjs): --root, --rules-dir, --baseline-file, --conventions.
 * Contract and porting guide: scripts/check/README.md. Dependency-free; ESM.
 */
import { existsSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  BASELINE_PATH,
  evaluate,
  nextEntry,
  raises,
  readBaseline,
  writeBaseline,
} from "./baseline.mjs";
import { createFsContext, createMemoryContext } from "./context.mjs";
import { RULES_DIR, SCOPES, loadRules, runnerFor, validateRules } from "./registry.mjs";

const REPO_ROOT = dirname(dirname(dirname(fileURLToPath(import.meta.url))));
export const CONVENTIONS_PATH = join(REPO_ROOT, ".claude", "rules", "conventions.md");
export const DOCS_START = "<!-- brand-ui:gen:check-rules:start -->";
export const DOCS_END = "<!-- brand-ui:gen:check-rules:end -->";
const FINDINGS_CAP = 50;

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

/** Fixture problems for one rule (empty = every fail fixture finds ≥1, every pass finds 0). */
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
        if (kind === "pass" && findings.length > 0)
          problems.push(
            `${rule.id}: fixtures.pass[${i}] yielded ${findings.length} finding(s): ${findings[0].msg}`,
          );
        if (kind === "fail" && findings.length === 0)
          problems.push(`${rule.id}: fixtures.fail[${i}] yielded 0 findings`);
      } catch (err) {
        problems.push(`${rule.id}: fixtures.${kind}[${i}] threw: ${err.message}`);
      }
    }
  }
  return problems;
}

const byLocation = (a, b) => a.file.localeCompare(b.file) || (a.line ?? 0) - (b.line ?? 0);

function printFindings(log, findings) {
  const sorted = [...findings].sort(byLocation);
  for (const f of sorted.slice(0, FINDINGS_CAP))
    log(`    ${f.file}:${f.line ?? 1}  ${f.warn ? "(advisory) " : ""}${f.msg}`);
  if (sorted.length > FINDINGS_CAP) log(`    …and ${sorted.length - FINDINGS_CAP} more`);
}

// ──────────────────────────────── docs ────────────────────────────────────────

export function renderDocs(rules) {
  const lines = [
    DOCS_START,
    "",
    "## Checked conventions",
    "",
    "Generated from `scripts/check/rules/*.mjs` (`pnpm check:docs`). Edit a rule's `doc`, never this block; `pnpm check` enforces each line.",
  ];
  for (const scope of SCOPES) {
    const inScope = rules.filter((r) => r.scope === scope).sort((a, b) => a.id.localeCompare(b.id));
    if (inScope.length === 0) continue;
    lines.push("", `### ${scope[0].toUpperCase()}${scope.slice(1)}`, "");
    for (const r of inScope) lines.push(`- ${r.doc.trim()} (\`${r.id}\`)`);
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
  const conventionsPath = o.conventionsPath ? resolve(o.conventionsPath) : CONVENTIONS_PATH;
  const loaded = await loadRules(o.rulesDir ? resolve(o.rulesDir) : RULES_DIR);
  const all = loaded.map((l) => l.rule);

  if (o.test) return registerTests(loaded, readBaseline(baselinePath));

  const shapeErrors = validateRules(loaded);
  if (shapeErrors.length) {
    for (const e of shapeErrors) error(`✖ ${e}`);
    return 1;
  }

  if (o.docs) {
    const current = existsSync(conventionsPath) ? readFileSync(conventionsPath, "utf8") : "";
    const next = applyDocs(current, renderDocs(all));
    if (o.check) {
      if (next !== current) {
        error(`✖ check --docs: ${conventionsPath} is stale — run \`pnpm check:docs\`.`);
        return 1;
      }
      log("✔ check --docs: conventions are up to date.");
      return 0;
    }
    if (next !== current) writeFileSync(conventionsPath, next);
    log(`✔ check --docs: ${next === current ? "unchanged" : "wrote"} ${conventionsPath}`);
    return 0;
  }

  const unknown = o.rules.filter((id) => !all.some((r) => r.id === id));
  if (unknown.length) {
    error(`✖ check: unknown rule id(s): ${unknown.join(", ")}`);
    return 2;
  }
  const selected = all.filter(
    (r) => (o.rules.length === 0 || o.rules.includes(r.id)) && (!o.scope || r.scope === o.scope),
  );
  const baseline = readBaseline(baselinePath);

  if (o.list) {
    for (const r of selected) {
      const e = baseline[r.id];
      const size =
        r.baseline === "none" ? "0" : typeof e === "number" ? e : Object.keys(e ?? {}).length;
      log(`${r.id}\t${r.scope}\t${r.baseline}:${size}\t${r.doc}`);
    }
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
  if (o.json) {
    log(JSON.stringify({ ok: failed === 0, rules: report.map(({ failing, ...r }) => r) }, null, 2));
  } else {
    log(
      `${failed ? "✖" : "✔"} check: ${results.length - failed}/${results.length} rules pass (${Date.now() - started}ms)`,
    );
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

/** `--test`: register node:test cases; node reports and sets the exit code. */
async function registerTests(loaded, baseline) {
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
