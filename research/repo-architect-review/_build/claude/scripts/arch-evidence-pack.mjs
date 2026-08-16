#!/usr/bin/env node
/**
 * arch-evidence-pack.mjs — Phase-0 of /repo-architect-review.
 *
 * Collects the DETERMINISTIC evidence base once (so the auditor subagents read it
 * instead of each re-running the toolchain), and runs the "garden" drift pass
 * (dead links, unresolved rule imports, oversized context files, orphan agents,
 * missing hook files, registry/manifest vs. filesystem, candidate raw-hex /
 * cross-package imports, CI presence). Modeled on the doc-gardener pattern from
 * wshobson/agents (see research/repo-architect-review/03-external-learnings.md):
 * every finding carries a `code`, a `severity`, and a concrete `fix`.
 *
 * READ-ONLY on the repo. Writes ONLY under the run dir. Self-contained (no
 * @qlik-coe-emea/qlabs-components-* import) so it stays portable when the audit is packaged as a plugin.
 *
 * Usage:
 *   node .claude/scripts/arch-evidence-pack.mjs                 # standard depth
 *   node .claude/scripts/arch-evidence-pack.mjs --depth quick   # scans only, no toolchain
 *   node .claude/scripts/arch-evidence-pack.mjs --no-toolchain  # force-skip pnpm checks
 *   node .claude/scripts/arch-evidence-pack.mjs --area packages/ui
 *   node .claude/scripts/arch-evidence-pack.mjs --strict        # exit 1 on any error finding
 *   node .claude/scripts/arch-evidence-pack.mjs --out <dir>     # override run dir
 *
 * Contract: writes <out>/index.json + <out>/index.md per
 * .claude/rules/architecture-review.md → handover contract ①.
 */
import { readFileSync, existsSync, readdirSync, statSync, mkdirSync, writeFileSync } from "node:fs";
import { join, dirname, relative, resolve, basename } from "node:path";
import { execSync } from "node:child_process";

// ── repo root (self-contained: walk up for pnpm-workspace.yaml or .git) ──────────
function findRepoRoot(start) {
  let dir = resolve(start);
  for (;;) {
    if (existsSync(join(dir, "pnpm-workspace.yaml")) || existsSync(join(dir, ".git"))) return dir;
    const parent = dirname(dir);
    if (parent === dir) return resolve(start);
    dir = parent;
  }
}
const ROOT = findRepoRoot(process.cwd());

// ── args ─────────────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
const getFlag = (name) => argv.includes(name);
const getOpt = (name, dflt) => {
  const i = argv.indexOf(name);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : dflt;
};
const depth = getOpt("--depth", "standard"); // quick | standard | deep
const noToolchain = getFlag("--no-toolchain") || depth === "quick";
const strict = getFlag("--strict");
const area = getOpt("--area", null);
const today = new Date().toISOString().slice(0, 10);
const outDir = resolve(
  getOpt("--out", join(ROOT, "research/repo-architect-review/runs", today, "evidence")),
);

// ── helpers ────────────────────────────────────────────────────────────────────
const rel = (p) => relative(ROOT, p) || ".";
const findings = []; // {code, dim, severity, path, message, fix}
const add = (f) => findings.push(f);
const SEV_ORDER = { error: 0, warning: 1, info: 2 };

function walk(dir, filterFn, acc = []) {
  let ents = [];
  try {
    ents = readdirSync(dir, { withFileTypes: true });
  } catch {
    return acc;
  }
  for (const e of ents) {
    if (e.name === "node_modules" || e.name === ".git" || e.name === ".turbo") continue;
    const p = join(dir, e.name);
    if (e.isDirectory()) walk(p, filterFn, acc);
    else if (filterFn(p)) acc.push(p);
  }
  return acc;
}
const read = (p) => {
  try {
    return readFileSync(p, "utf8");
  } catch {
    return "";
  }
};
const lines = (p) => read(p).split("\n");

// ── counts (structure / coverage evidence) ───────────────────────────────────
function collectCounts() {
  const pkgDir = join(ROOT, "packages");
  const packages = existsSync(pkgDir)
    ? readdirSync(pkgDir).filter((d) => statSync(join(pkgDir, d)).isDirectory())
    : [];
  const perPackage = {};
  for (const pkg of packages) {
    const src = join(pkgDir, pkg, "src");
    const tsx = walk(
      src,
      (p) => p.endsWith(".tsx") && !p.includes(".stories.") && !p.includes(".test."),
    );
    const stories = walk(src, (p) => p.endsWith(".stories.tsx"));
    const tests = walk(src, (p) => p.endsWith(".test.tsx") || p.endsWith(".test.ts"));
    perPackage[pkg] = { components: tsx.length, stories: stories.length, tests: tests.length };
    if (tests.length === 0 && tsx.length > 0) {
      add({
        code: "ZERO_TEST_PACKAGE",
        dim: "D2",
        severity: "warning",
        path: join(pkgDir, pkg),
        message: `packages/${pkg} has ${tsx.length} component file(s) and 0 tests`,
        fix: `Add at least one smoke test per public component in packages/${pkg} (quality-gates.md).`,
      });
    }
  }
  const countDir = (p, fn) => (existsSync(p) ? readdirSync(p).filter(fn).length : 0);
  return {
    packages: packages.length,
    packageList: packages,
    perPackage,
    agents: countDir(join(ROOT, ".claude/agents"), (f) => f.endsWith(".md")),
    commands: countDir(join(ROOT, ".claude/commands"), (f) => f.endsWith(".md")),
    rules: countDir(join(ROOT, ".claude/rules"), (f) => f.endsWith(".md")),
    hooks: countDir(join(ROOT, ".claude/hooks"), (f) => f.endsWith(".sh")),
  };
}

// ── garden: dead doc links + unresolved CLAUDE.md @imports ───────────────────
function checkLinksAndImports() {
  const docFiles = [
    ...["README.md", "CLAUDE.md", "AGENTS.md", "PROJECT.md", "CONTRIBUTING.md"].map((f) =>
      join(ROOT, f),
    ),
    ...walk(join(ROOT, "docs"), (p) => p.endsWith(".md")),
    ...walk(join(ROOT, ".claude/rules"), (p) => p.endsWith(".md")),
    ...walk(join(ROOT, ".claude/commands"), (p) => p.endsWith(".md")),
  ].filter(existsSync);

  const linkRe = /\[[^\]]+\]\(([^)]+)\)/g;
  const importRe = /^@([.\/A-Za-z0-9_-]+\.md)\s*$/;

  for (const f of docFiles) {
    const text = read(f);
    text.split("\n").forEach((line, i) => {
      // CLAUDE.md-style @imports
      const im = line.match(importRe);
      if (im) {
        const target = resolve(ROOT, im[1]);
        if (!existsSync(target)) {
          add({
            code: "UNRESOLVED_RULE_IMPORT",
            dim: "D9",
            severity: "error",
            path: f,
            message: `@${im[1]} (line ${i + 1}) does not resolve`,
            fix: "Correct the @import path or create the missing rule file.",
          });
        }
      }
    });
    for (const m of text.matchAll(linkRe)) {
      let link = m[1].split(" ")[0].split("#")[0].trim();
      if (!link || link.startsWith("http://") || link.startsWith("https://")) continue;
      if (link.startsWith("mailto:") || link.startsWith("<")) continue; // template/placeholder
      const target = resolve(dirname(f), link);
      if (!existsSync(target)) {
        add({
          code: "DEAD_DOC_LINK",
          dim: "D9",
          severity: "error",
          path: f,
          message: `link to \`${link}\` does not resolve`,
          fix: "Update the link target or create the missing file.",
        });
      }
    }
  }
}

// ── garden: oversized context files ──────────────────────────────────────────
function checkContextSizes() {
  const caps = { "CLAUDE.md": 220, "AGENTS.md": 200, "PROJECT.md": 200 };
  for (const [name, cap] of Object.entries(caps)) {
    const p = join(ROOT, name);
    if (!existsSync(p)) continue;
    const n = lines(p).length;
    if (n > cap) {
      add({
        code: "OVERSIZED_CONTEXT_FILE",
        dim: "D9",
        severity: "warning",
        path: p,
        message: `${n} lines (cap ${cap}) — loaded every session`,
        fix: "Move detail into docs/ or a rule; keep the context file a table of contents (progressive disclosure).",
      });
    }
  }
}

// ── garden: agents (collisions, scoping, orphans) ────────────────────────────
function checkAgents() {
  const agentsDir = join(ROOT, ".claude/agents");
  if (!existsSync(agentsDir)) return;
  const files = readdirSync(agentsDir).filter((f) => f.endsWith(".md"));
  const byName = {};
  const names = [];
  for (const f of files) {
    const fm = read(join(agentsDir, f)).match(/^---\n([\s\S]*?)\n---/);
    const nm = fm && fm[1].match(/^name:\s*(.+)$/m);
    const name = nm ? nm[1].trim().replace(/['"]/g, "") : f.replace(/\.md$/, "");
    names.push(name);
    (byName[name] ||= []).push(f);
  }
  // in-repo duplicate names (true collision)
  for (const [name, fs2] of Object.entries(byName)) {
    if (fs2.length > 1) {
      add({
        code: "AGENT_NAME_COLLISION",
        dim: "D3",
        severity: "error",
        path: agentsDir,
        message: `agent name \`${name}\` declared by ${fs2.length} files: ${fs2.join(", ")}`,
        fix: "Rename so each agent name is unique; plugin-scope shared role names.",
      });
    }
  }
  // un-scoped names (collision risk when shipped via the plugin — the 03 finding)
  const unscoped = names.filter(
    (n) => !n.startsWith("brand-ui") && !n.startsWith("repo-architect"),
  );
  if (unscoped.length) {
    add({
      code: "AGENT_NAME_COLLISION",
      dim: "D9",
      severity: "info",
      path: agentsDir,
      message: `${unscoped.length} agent name(s) are not plugin-scoped — collision risk if the brand-ui plugin is installed beside another marketplace: ${unscoped.join(", ")}`,
      fix: "Plugin-scope shared role names (e.g. `brand-ui-<role>`) and add a collision gate (see 03-external-learnings.md).",
    });
  }
  // orphan agents (defined but never referenced)
  const refCorpus = [
    ...walk(join(ROOT, ".claude/commands"), (p) => p.endsWith(".md")),
    ...walk(join(ROOT, ".claude/rules"), (p) => p.endsWith(".md")),
    join(ROOT, "CLAUDE.md"),
    join(ROOT, "AGENTS.md"),
  ]
    .filter(existsSync)
    .map(read)
    .join("\n");
  for (const name of names) {
    if (!refCorpus.includes(name)) {
      add({
        code: "ORPHAN_AGENT",
        dim: "D9",
        severity: "info",
        path: join(agentsDir, `${name}.md`),
        message: `agent \`${name}\` is not referenced by any command, rule, or context file`,
        fix: "Reference it from a command/rule, or remove it if superseded.",
      });
    }
  }
}

// ── garden: hooks wired in settings.json must exist ──────────────────────────
function checkHooks() {
  const sp = join(ROOT, ".claude/settings.json");
  if (!existsSync(sp)) return;
  let json;
  try {
    json = JSON.parse(read(sp));
  } catch (e) {
    add({
      code: "HOOK_FILE_MISSING",
      dim: "D9",
      severity: "error",
      path: sp,
      message: `settings.json does not parse: ${e.message}`,
      fix: "Fix the JSON syntax in .claude/settings.json.",
    });
    return;
  }
  const cmds = JSON.stringify(json.hooks || {}).match(/\.claude\/hooks\/[A-Za-z0-9_-]+\.sh/g) || [];
  for (const c of [...new Set(cmds)]) {
    if (!existsSync(join(ROOT, c))) {
      add({
        code: "HOOK_FILE_MISSING",
        dim: "D9",
        severity: "error",
        path: sp,
        message: `settings.json wires ${c} but the file is missing`,
        fix: `Create ${c} or remove its entry from settings.json.`,
      });
    }
  }
}

// ── garden: manifest staleness + registry/manifest presence ──────────────────
function checkManifestAndRegistry() {
  const manifest = join(ROOT, "brand-ui.manifest.json");
  if (existsSync(manifest)) {
    // staleness heuristic: any packages/*/src file newer than the manifest
    const mtime = statSync(manifest).mtimeMs;
    const srcFiles = walk(join(ROOT, "packages"), (p) => /\.(tsx?|css)$/.test(p));
    const newer = srcFiles.filter((p) => statSync(p).mtimeMs > mtime + 1000);
    if (newer.length) {
      add({
        code: "STALE_MANIFEST",
        dim: "D6",
        severity: "warning",
        path: manifest,
        message: `${newer.length} source file(s) are newer than brand-ui.manifest.json (manifest may be stale)`,
        fix: "Run `pnpm manifest` to regenerate, and confirm `pnpm manifest:check` is green.",
      });
    }
  } else {
    add({
      code: "SHALLOW_MANIFEST",
      dim: "D6",
      severity: "warning",
      path: ROOT,
      message: "brand-ui.manifest.json not found",
      fix: "Generate the manifest (`pnpm manifest`); it is the agent ground-truth index.",
    });
  }
  const reg = join(ROOT, "registry/registry.json");
  if (existsSync(reg)) {
    try {
      JSON.parse(read(reg));
    } catch (e) {
      add({
        code: "MISPLACED_EXPORT",
        dim: "D4",
        severity: "error",
        path: reg,
        message: `registry.json does not parse: ${e.message}`,
        fix: "Fix the JSON and run `pnpm registry:validate`.",
      });
    }
  }
}

// ── garden: CI presence + doc-claims-absent-machinery ────────────────────────
function checkCi() {
  const wfDir = join(ROOT, ".github/workflows");
  const wfs = existsSync(wfDir) ? readdirSync(wfDir).filter((f) => /\.ya?ml$/.test(f)) : [];
  if (wfs.length === 0) {
    add({
      code: "NO_CI",
      dim: "D7",
      severity: "error",
      path: join(ROOT, ".github"),
      message: "no .github/workflows/*.yml — quality gates run only locally",
      fix: "Add a CI workflow that runs typecheck/lint/test/build (enterprise-gap WP-01).",
    });
  }
  // docs referencing a workflow that doesn't exist (doc-truth)
  const docs = [
    join(ROOT, "README.md"),
    join(ROOT, "AGENTS.md"),
    join(ROOT, "PROJECT.md"),
    ...walk(join(ROOT, "docs"), (p) => p.endsWith(".md")),
  ].filter(existsSync);
  const wfRe = /\.github\/workflows\/([A-Za-z0-9_-]+\.ya?ml)/g;
  for (const f of docs) {
    for (const m of read(f).matchAll(wfRe)) {
      if (!existsSync(join(wfDir, m[1]))) {
        add({
          code: "DOC_CLAIMS_ABSENT_MACHINERY",
          dim: "D7",
          severity: "warning",
          path: f,
          message: `references .github/workflows/${m[1]} which does not exist`,
          fix: "Create the workflow or correct the reference (doc-truth).",
        });
      }
    }
  }
}

// ── garden: candidate raw-hex in components (auditor confirms) ────────────────
function checkRawHex() {
  const pkgSrc = walk(join(ROOT, "packages"), (p) => /\.(tsx|css)$/.test(p)).filter(
    (p) => !p.endsWith("themes.css") && !p.includes("/tokens/src/"),
  );
  const hexRe = /#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b/;
  const hits = [];
  for (const p of pkgSrc) {
    lines(p).forEach((ln, i) => {
      if (hexRe.test(ln) && !ln.trimStart().startsWith("//") && !ln.trimStart().startsWith("*")) {
        hits.push(`${rel(p)}:${i + 1}`);
      }
    });
  }
  if (hits.length) {
    add({
      code: "RAW_HEX_IN_COMPONENT",
      dim: "D5",
      severity: "warning",
      path: join(ROOT, "packages"),
      message: `${hits.length} candidate raw-hex color(s) outside tokens (auditor to confirm): ${hits.slice(0, 8).join(", ")}${hits.length > 8 ? " …" : ""}`,
      fix: "Replace raw hex with a semantic token; raw colors live only in tokens/src/themes.css (styling-and-tokens.md).",
    });
  }
}

// ── toolchain capture (Measured) ─────────────────────────────────────────────
function runToolchain() {
  const cmds = [
    ["typecheck", "pnpm -s typecheck"],
    ["lint", "pnpm -s lint"],
    ["test", "pnpm -s test"],
    ["build", "pnpm -s build"],
    ["registry:validate", "pnpm -s registry:validate"],
    ["manifest:check", "pnpm -s manifest:check"],
    ["components:check", "pnpm -s components:check"],
    ["docs:check", "pnpm -s docs:check"],
    ["format:check", "pnpm -s format:check"],
  ];
  const results = [];
  const logDir = join(outDir, "logs");
  mkdirSync(logDir, { recursive: true });
  for (const [name, cmd] of cmds) {
    const t0 = Date.now();
    let ok = true,
      exitCode = 0,
      out = "";
    try {
      out = execSync(cmd, { cwd: ROOT, stdio: "pipe", timeout: 240000, encoding: "utf8" });
    } catch (e) {
      ok = false;
      exitCode = e.status ?? 1;
      out = `${e.stdout || ""}\n${e.stderr || ""}`.trim();
    }
    const ms = Date.now() - t0;
    try {
      writeFileSync(join(logDir, `${name.replace(/[:]/g, "-")}.log`), out);
    } catch {}
    results.push({ check: name, command: cmd, ok, exitCode, ms, tail: out.slice(-400) });
    if (!ok) {
      add({
        code: name === "build" ? "BUILD_RED" : "TOOLCHAIN_RED",
        dim: name === "build" ? "D8" : "D5",
        severity: "error",
        path: ROOT,
        message: `\`${cmd}\` exited ${exitCode}`,
        fix: `Fix the failure shown in evidence/logs/${name.replace(/[:]/g, "-")}.log before relying on this gate.`,
      });
    }
  }
  return results;
}

// ── render + write ───────────────────────────────────────────────────────────
function severityCounts() {
  const c = { error: 0, warning: 0, info: 0 };
  for (const f of findings) c[f.severity] = (c[f.severity] || 0) + 1;
  return c;
}

function writeOutputs(counts, toolchain) {
  mkdirSync(outDir, { recursive: true });
  const sorted = [...findings].sort(
    (a, b) => SEV_ORDER[a.severity] - SEV_ORDER[b.severity] || a.code.localeCompare(b.code),
  );
  const index = {
    generatedAt: new Date().toISOString(),
    repoRoot: ROOT,
    depth,
    area,
    confidence: depth === "quick" ? "Estimated" : depth === "deep" ? "Certified" : "Assessed",
    counts,
    toolchain,
    gardenFindings: sorted.map((f) => ({ ...f, path: rel(f.path) })),
    severity: severityCounts(),
  };
  writeFileSync(join(outDir, "index.json"), JSON.stringify(index, null, 2));

  const byCode = {};
  for (const f of sorted)
    byCode[`${f.severity}:${f.code}`] = (byCode[`${f.severity}:${f.code}`] || 0) + 1;
  const md = [];
  md.push(
    `# Evidence pack — ${index.generatedAt.slice(0, 10)} (depth: ${depth}, confidence: ${index.confidence})`,
  );
  md.push("");
  md.push("> Deterministic Phase-0 evidence for /repo-architect-review. Auditors cite entries");
  md.push("> here by path; they do NOT re-run the toolchain. Read-only; finders report.");
  md.push("");
  md.push("## Counts");
  md.push("");
  md.push(
    `packages ${counts.packages} · agents ${counts.agents} · commands ${counts.commands} · rules ${counts.rules} · hooks ${counts.hooks}`,
  );
  md.push("");
  md.push("| package | components | stories | tests |");
  md.push("| ------- | ---------- | ------- | ----- |");
  for (const [pkg, v] of Object.entries(counts.perPackage)) {
    md.push(`| ${pkg} | ${v.components} | ${v.stories} | ${v.tests} |`);
  }
  md.push("");
  md.push("## Toolchain (Measured)");
  md.push("");
  if (!toolchain.length) {
    md.push(
      `_skipped (depth=${depth}${noToolchain ? ", --no-toolchain" : ""}) — run at depth ≥ standard for Measured gate results._`,
    );
  } else {
    md.push("| check | result | exit | ms |");
    md.push("| ----- | ------ | ---- | -- |");
    for (const t of toolchain)
      md.push(`| ${t.check} | ${t.ok ? "✓" : "✗"} | ${t.exitCode} | ${t.ms} |`);
  }
  md.push("");
  md.push("## Garden findings (deterministic)");
  md.push("");
  if (!sorted.length) md.push("_none — garden is clean._");
  else {
    md.push("Summary:");
    md.push("");
    for (const [k, n] of Object.entries(byCode).sort()) md.push(`- ${k} × ${n}`);
    md.push("");
    for (const f of sorted) {
      md.push(`- **[${f.severity}] ${f.code}** (${f.dim}) — ${rel(f.path)}: ${f.message}`);
      md.push(`  - Fix: ${f.fix}`);
    }
  }
  md.push("");
  writeFileSync(join(outDir, "index.md"), md.join("\n"));
}

// ── main ─────────────────────────────────────────────────────────────────────
const counts = collectCounts();
checkLinksAndImports();
checkContextSizes();
checkAgents();
checkHooks();
checkManifestAndRegistry();
checkCi();
checkRawHex();
const toolchain = noToolchain ? [] : runToolchain();
writeOutputs(counts, toolchain);

const sev = severityCounts();
console.log(`arch-evidence-pack → ${rel(outDir)}`);
console.log(
  `  depth=${depth} confidence=${depth === "quick" ? "Estimated" : depth === "deep" ? "Certified" : "Assessed"}`,
);
console.log(
  `  packages=${counts.packages} agents=${counts.agents} commands=${counts.commands} rules=${counts.rules} hooks=${counts.hooks}`,
);
console.log(
  `  toolchain: ${toolchain.length ? toolchain.map((t) => `${t.check}${t.ok ? "✓" : "✗"}`).join(" ") : "(skipped)"}`,
);
console.log(`  garden: ${sev.error} error · ${sev.warning} warning · ${sev.info} info`);
for (const f of [...findings].sort((a, b) => SEV_ORDER[a.severity] - SEV_ORDER[b.severity])) {
  console.log(`    [${f.severity}] ${f.code} (${f.dim}) — ${rel(f.path)}: ${f.message}`);
}
if (strict && sev.error > 0) process.exit(1);
