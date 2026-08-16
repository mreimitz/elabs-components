#!/usr/bin/env node
/**
 * detect-stack.mjs — what kind of repo is this, and how do you check it?
 *
 * The portability seam. Every other script and every reference in this skill
 * consumes `stack.json` instead of assuming pnpm, vitest, or a `roadmap/`
 * folder. Adding a language means adding an adapter here — see
 * references/stack-adapters.md for the contract.
 *
 * Two rules this file exists to enforce:
 *  1. A detected gate command is a CANDIDATE, never a promise. It is reported
 *     with the evidence that produced it (`package.json#scripts.test`) so the
 *     model can see whether the detection is trustworthy before running it.
 *  2. Absence is a first-class answer. A repo with no manifest, no git and no
 *     test runner must produce a valid stack.json with empty fields, not throw.
 *
 * Usage: node detect-stack.mjs [--json] [--root <dir>]
 * Zero dependencies. Node >= 22.
 */

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { findRepoRoot, loadConfig } from "./config.mjs";

/** @typedef {{ id: string, command: string, source: string }} Candidate */

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return null;
  }
}

function exists(root, rel) {
  return existsSync(join(root, rel));
}

// --------------------------------------------------------------------------
// package manager
// --------------------------------------------------------------------------

function detectPackageManager(root, pkg) {
  // `packageManager` is the declared truth when present (corepack).
  if (typeof pkg?.packageManager === "string") {
    const name = pkg.packageManager.split("@")[0];
    return { name, source: "package.json#packageManager", confidence: "confirmed" };
  }
  const locks = [
    ["pnpm-lock.yaml", "pnpm"],
    ["bun.lockb", "bun"],
    ["bun.lock", "bun"],
    ["yarn.lock", "yarn"],
    ["package-lock.json", "npm"],
  ];
  for (const [file, name] of locks) {
    if (exists(root, file)) return { name, source: file, confidence: "high" };
  }
  return { name: null, source: null, confidence: "low" };
}

// --------------------------------------------------------------------------
// languages
// --------------------------------------------------------------------------

function detectLanguages(root) {
  /** @type {{ id: string, evidence: string }[]} */
  const langs = [];
  const add = (id, evidence) => {
    if (!langs.some((l) => l.id === id)) langs.push({ id, evidence });
  };
  if (exists(root, "package.json")) add("javascript", "package.json");
  if (exists(root, "tsconfig.json")) add("typescript", "tsconfig.json");
  for (const f of ["pyproject.toml", "requirements.txt", "setup.py", "Pipfile"])
    if (exists(root, f)) add("python", f);
  if (exists(root, "go.mod")) add("go", "go.mod");
  if (exists(root, "Cargo.toml")) add("rust", "Cargo.toml");
  if (exists(root, "pom.xml")) add("java", "pom.xml");
  if (exists(root, "Gemfile")) add("ruby", "Gemfile");
  for (const f of ["Dockerfile", "docker-compose.yml", "compose.yaml"])
    if (exists(root, f)) add("docker", f);
  return langs;
}

// --------------------------------------------------------------------------
// monorepo
// --------------------------------------------------------------------------

function detectMonorepo(root, pkg) {
  if (exists(root, "pnpm-workspace.yaml"))
    return { isMonorepo: true, source: "pnpm-workspace.yaml" };
  if (Array.isArray(pkg?.workspaces) || pkg?.workspaces?.packages)
    return { isMonorepo: true, source: "package.json#workspaces" };
  for (const f of ["turbo.json", "nx.json", "lerna.json", "rush.json"])
    if (exists(root, f)) return { isMonorepo: true, source: f };
  return { isMonorepo: false, source: null };
}

// --------------------------------------------------------------------------
// gate commands
// --------------------------------------------------------------------------

/** Script names we recognise, in the order a gate should run them. */
const GATE_ROLES = [
  { id: "typecheck", names: ["typecheck", "type-check", "tsc", "types"] },
  { id: "test", names: ["test", "tests", "test:unit", "unit"] },
  { id: "lint", names: ["lint", "check", "biome", "eslint"] },
  { id: "build", names: ["build", "compile"] },
  { id: "e2e", names: ["e2e", "test:e2e", "playwright"] },
];

function detectNodeGate(root, pkg, pmName) {
  /** @type {Candidate[]} */
  const candidates = [];
  const scripts = pkg?.scripts ?? {};
  const runner = pmName ?? "npm";
  for (const role of GATE_ROLES) {
    const hit = role.names.find((n) => typeof scripts[n] === "string");
    if (!hit) continue;
    const command = runner === "npm" ? `npm run ${hit}` : `${runner} ${hit}`;
    candidates.push({ id: role.id, command, source: `package.json#scripts.${hit}` });
  }
  return candidates;
}

function detectPythonGate(root) {
  /** @type {Candidate[]} */
  const candidates = [];
  const pyproject = exists(root, "pyproject.toml")
    ? readFileSync(join(root, "pyproject.toml"), "utf8")
    : "";
  if (/\[tool\.pytest/.test(pyproject) || exists(root, "pytest.ini") || exists(root, "tests"))
    candidates.push({ id: "test", command: "pytest", source: "pyproject.toml / tests dir" });
  if (/\[tool\.ruff/.test(pyproject))
    candidates.push({ id: "lint", command: "ruff check .", source: "pyproject.toml#tool.ruff" });
  if (/\[tool\.mypy/.test(pyproject))
    candidates.push({ id: "typecheck", command: "mypy .", source: "pyproject.toml#tool.mypy" });
  return candidates;
}

function detectGate(root, pkg, pmName, languages) {
  const ids = new Set(languages.map((l) => l.id));
  /** @type {Candidate[]} */
  let candidates = [];
  if (ids.has("javascript") || ids.has("typescript"))
    candidates.push(...detectNodeGate(root, pkg, pmName));
  if (ids.has("python")) candidates.push(...detectPythonGate(root));
  if (ids.has("go")) candidates.push({ id: "test", command: "go test ./...", source: "go.mod" });
  if (ids.has("rust")) candidates.push({ id: "test", command: "cargo test", source: "Cargo.toml" });
  // de-dupe by role, first adapter wins
  const seen = new Set();
  candidates = candidates.filter((c) => (seen.has(c.id) ? false : (seen.add(c.id), true)));
  return candidates;
}

// --------------------------------------------------------------------------
// test runner / linter
// --------------------------------------------------------------------------

function detectTooling(root, pkg) {
  const deps = { ...(pkg?.dependencies ?? {}), ...(pkg?.devDependencies ?? {}) };
  const pick = (names) => names.find((n) => n in deps) ?? null;
  return {
    testRunner: pick(["vitest", "jest", "mocha", "ava", "node:test", "@playwright/test"]),
    linter: pick(["@biomejs/biome", "eslint", "oxlint"]),
    formatter: pick(["@biomejs/biome", "prettier", "dprint"]),
    bundler: pick(["vite", "electron-vite", "webpack", "rollup", "esbuild", "next"]),
  };
}

// --------------------------------------------------------------------------
// roots
// --------------------------------------------------------------------------

const COMMON_SOURCE_ROOTS = ["src", "lib", "app", "packages", "source"];
const COMMON_GENERATED_ROOTS = [
  "dist",
  "build",
  "out",
  "coverage",
  ".next",
  "target",
  "__pycache__",
];
const COMMON_TEST_ROOTS = ["test", "tests", "__tests__", "spec", "e2e"];

function detectRoots(root) {
  const isDir = (rel) => {
    try {
      return statSync(join(root, rel)).isDirectory();
    } catch {
      return false;
    }
  };
  return {
    source: COMMON_SOURCE_ROOTS.filter(isDir),
    tests: COMMON_TEST_ROOTS.filter(isDir),
    generated: COMMON_GENERATED_ROOTS.filter(isDir),
  };
}

// --------------------------------------------------------------------------
// claude surfaces (presence only — context-footprint.mjs measures them)
// --------------------------------------------------------------------------

function detectClaudeSurfaces(root) {
  const dir = join(root, ".claude");
  const listDir = (rel) => {
    try {
      return readdirSync(join(dir, rel));
    } catch {
      return [];
    }
  };
  return {
    claudeMd: exists(root, "CLAUDE.md"),
    claudeDir: existsSync(dir),
    rules: listDir("rules").filter((f) => f.endsWith(".md")).length,
    commands: listDir("commands").filter((f) => f.endsWith(".md")).length,
    agents: listDir("agents").filter((f) => f.endsWith(".md")).length,
    skills: listDir("skills").length,
    settings: exists(root, ".claude/settings.json"),
    settingsLocal: exists(root, ".claude/settings.local.json"),
    mcpJson: exists(root, ".mcp.json"),
    hooks: listDir("hooks").length,
  };
}

// --------------------------------------------------------------------------
// git
// --------------------------------------------------------------------------

function detectGit(root) {
  try {
    const count = execFileSync("git", ["rev-list", "--count", "HEAD"], {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    const branch = execFileSync("git", ["rev-parse", "--abbrev-ref", "HEAD"], {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    return { available: true, commits: Number.parseInt(count, 10) || 0, branch };
  } catch {
    // No git, a fresh repo with no commits, or git not installed. All fine.
    return { available: false, commits: 0, branch: null };
  }
}

// --------------------------------------------------------------------------
// main
// --------------------------------------------------------------------------

/** @param {string} [rootArg] */
export function detectStack(rootArg) {
  const root = rootArg ?? findRepoRoot();
  const { config, source: configSource, warnings } = loadConfig(root);
  const pkg = readJson(join(root, "package.json"));
  const pm = detectPackageManager(root, pkg);
  const languages = detectLanguages(root);
  const gateCandidates = detectGate(root, pkg, pm.name, languages);

  const configuredGate = config.gate && config.gate !== "auto" ? String(config.gate) : null;
  const detectedGate =
    gateCandidates.length > 0
      ? gateCandidates
          .filter((c) => ["typecheck", "test", "lint"].includes(c.id))
          .map((c) => c.command)
          .join(" && ")
      : null;

  return {
    schema: "repo-cleanup/stack@1",
    root,
    generatedBy: "detect-stack.mjs",
    config: { source: configSource, warnings },
    languages,
    packageManager: pm,
    monorepo: detectMonorepo(root, pkg),
    tooling: detectTooling(root, pkg),
    roots: detectRoots(root),
    git: detectGit(root),
    claude: detectClaudeSurfaces(root),
    gate: {
      // configured wins; detected is a candidate the caller must confirm
      effective: configuredGate ?? detectedGate,
      configured: configuredGate,
      detected: detectedGate,
      candidates: gateCandidates,
      confidence: configuredGate ? "confirmed" : detectedGate ? "medium" : "none",
      note: configuredGate
        ? "from .repo-cleanup config `gate:`"
        : "DETECTED, not verified — announce before running (safety-model.md, potentially-expensive class)",
    },
    unsupported: languages.length === 0 && !pkg ? ["no manifest found — generic adapter only"] : [],
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const rootFlag = process.argv.indexOf("--root");
  const root = rootFlag !== -1 ? process.argv[rootFlag + 1] : undefined;
  process.stdout.write(`${JSON.stringify(detectStack(root), null, 2)}\n`);
}
