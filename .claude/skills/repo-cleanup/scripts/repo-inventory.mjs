#!/usr/bin/env node
/**
 * repo-inventory.mjs — dead weight, and how sure we are about it.
 *
 * Produces DELETION CANDIDATES, never deletions and never a claim that
 * something is safe to delete. Every candidate carries the searches that were
 * run, the searches that were NOT run, and the reasons static analysis could be
 * wrong about it.
 *
 * THE CENTRAL LIMITATION, stated once here and repeated in every candidate:
 * import extraction is REGEX-BASED, not a parser. It sees static `import`/
 * `require`/`export … from` and literal `import('…')`. It is blind to computed
 * specifiers, plugin registries, reflection, runtime-loaded templates, string
 * paths in config, and anything referenced from outside the repo. That blindness
 * is why nothing here is `confirmed` on its own.
 *
 * Usage: node repo-inventory.mjs [--root <dir>] [--no-git]
 * Zero dependencies. Node >= 22.
 */

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { basename, dirname, extname, join, relative, resolve } from "node:path";
import { findRepoRoot, loadConfig } from "./config.mjs";
import { isSecretBearingPath } from "./redact.mjs";

const CODE_EXT = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".mts", ".cts"]);
const RESOLVE_EXT = [
  "",
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  "/index.ts",
  "/index.tsx",
  "/index.js",
];

/**
 * Paths where "unused" is structurally unprovable by static search. A candidate
 * in one of these is reported with risk `high` and confidence no better than
 * `low`, regardless of how clean the search looked.
 */
const HIGH_RISK_PATTERNS = [
  { re: /(^|\/)migrations?\//i, why: "migration — runs by filename discovery, never imported" },
  { re: /(^|\/)(seeds?|fixtures?)\//i, why: "fixture/seed — often loaded by name at runtime" },
  {
    re: /(^|\/)(deploy|infra|terraform|k8s|helm|\.github)\//i,
    why: "deployment/infrastructure — consumed outside the repo",
  },
  { re: /(^|\/)(locales?|i18n|translations?)\//i, why: "localisation — keys resolved dynamically" },
  { re: /(^|\/)(public|static|assets)\//i, why: "served asset — referenced by URL, not by import" },
  {
    re: /\.(sql|sh|ps1|yml|yaml|toml|ini)$/i,
    why: "non-code — invoked by tooling this scan does not model",
  },
  {
    re: /(^|\/)(index|main|cli|bin|server|worker|preload)\.[cm]?[jt]sx?$/i,
    why: "conventional entry point",
  },
  { re: /\.d\.ts$/i, why: "type declaration — consumed by the compiler, not by an import graph" },
];

function highRisk(rel) {
  return HIGH_RISK_PATTERNS.filter((p) => p.re.test(rel)).map((p) => p.why);
}

// --------------------------------------------------------------------------
// file listing
// --------------------------------------------------------------------------

function gitTracked(root) {
  try {
    return execFileSync("git", ["ls-files", "-z"], {
      cwd: root,
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
    })
      .split("\0")
      .filter(Boolean);
  } catch {
    return null;
  }
}

function walk(root, config) {
  /** @type {string[]} */
  const out = [];
  const rec = (dir, depth) => {
    if (depth > 12) return;
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      if (config.exclude.includes(e.name)) continue;
      const p = join(dir, e.name);
      if (e.isDirectory()) rec(p, depth + 1);
      else if (e.isFile()) out.push(relative(root, p));
    }
  };
  rec(root, 0);
  return out;
}

// --------------------------------------------------------------------------
// import extraction (regex — see the header)
// --------------------------------------------------------------------------

const IMPORT_RES = [
  /\bimport\s+(?:[\s\S]*?\sfrom\s+)?["']([^"']+)["']/g,
  /\bexport\s+(?:\*|\{[\s\S]*?\})\s+from\s+["']([^"']+)["']/g,
  /\brequire\s*\(\s*["']([^"']+)["']\s*\)/g,
  /\bimport\s*\(\s*["']([^"']+)["']\s*\)/g,
];

const DYNAMIC_RES = [/\bimport\s*\(\s*[^"')]/, /\brequire\s*\(\s*[^"')]/, /\bcreateRequire\b/];

/** @returns {{ specifiers: string[], hasComputedImport: boolean }} */
export function extractImports(source) {
  const specifiers = new Set();
  for (const re of IMPORT_RES) {
    re.lastIndex = 0;
    for (const m of source.matchAll(re)) if (m[1]) specifiers.add(m[1]);
  }
  return {
    specifiers: [...specifiers],
    hasComputedImport: DYNAMIC_RES.some((re) => re.test(source)),
  };
}

/** Resolve a relative specifier to a repo-relative file path, if one exists. */
function resolveLocal(root, fromFile, spec) {
  if (!spec.startsWith(".")) return null;
  const base = resolve(root, dirname(fromFile), spec);
  for (const ext of RESOLVE_EXT) {
    const candidate = ext.startsWith("/") ? join(base, ext.slice(1)) : base + ext;
    try {
      if (statSync(candidate).isFile()) return relative(root, candidate);
    } catch {
      // keep trying
    }
  }
  return null;
}

// --------------------------------------------------------------------------
// entry points
// --------------------------------------------------------------------------

/**
 * @param {string} root
 * @param {string[]} files repo-relative code files
 * @param {object|null} pkg the ROOT package.json (kept for the caller's signature)
 * @param {string[]} allFiles every tracked file, so workspace manifests are visible
 */
function entryPoints(root, files, pkg, allFiles = []) {
  const entries = new Set();
  const add = (p) => {
    if (p && files.includes(p)) entries.add(p);
  };

  /**
   * A package manifest's entry fields, resolved relative to THAT manifest's dir.
   *
   * Reading only the root `package.json` is wrong in any workspace: in a pnpm/yarn
   * monorepo every real entry point lives in `packages/<x>/package.json`, so the
   * root read finds nothing and every package barrel looks unreachable. Measured
   * 2026-08-02 in elabs-components: 385 "deletion candidates" out of 1,585 code
   * files, with the whole public API surface among them.
   *
   * @param {object|null} manifest @param {string} dir repo-relative dir ("" = root)
   */
  const addManifest = (manifest, dir) => {
    if (!manifest) return;
    const rel = (p) => (dir ? `${dir}/${p.replace(/^\.\//, "")}` : p.replace(/^\.\//, ""));
    for (const field of ["main", "module", "browser", "types", "source"])
      if (typeof manifest[field] === "string") add(rel(manifest[field]));
    for (const v of Object.values(manifest.bin ?? {})) if (typeof v === "string") add(rel(v));
    const walkExports = (v) => {
      if (typeof v === "string") add(rel(v));
      else if (v && typeof v === "object") for (const x of Object.values(v)) walkExports(x);
    };
    walkExports(manifest.exports);
    walkExports(manifest.publishConfig?.exports);
  };

  addManifest(pkg, "");
  for (const f of allFiles) {
    if (basename(f) !== "package.json" || f === "package.json") continue;
    if (f.includes("node_modules/")) continue;
    try {
      addManifest(JSON.parse(readFileSync(join(root, f), "utf8")), dirname(f));
    } catch {
      /* an unparseable manifest is not this gate's problem */
    }
  }

  for (const f of files) {
    const b = basename(f);
    if (/\.(test|spec)\.[cm]?[jt]sx?$/.test(b)) entries.add(f); // tests are roots
    // Glob-loaded by a tool, never imported: stories (Storybook `stories:` globs),
    // per-package test setup files, and ANY *.config.* (the previous fixed vendor
    // list missed `tsup.config.ts`, `vitest.workspace.ts`, `eslint.config.js`, …).
    if (/\.stories\.[cm]?[jt]sx?$/.test(b)) entries.add(f);
    if (/\.setup\.[cm]?[jt]sx?$/.test(b) || /^(setup-tests|test-setup)\./.test(b)) entries.add(f);
    if (/\.config\.[cm]?[jt]sx?$/.test(b) || /^[\w.-]+\.workspace\.[cm]?[jt]s$/.test(b))
      entries.add(f);
    if (/^(index|main|cli|bin|server|preload|worker)\.[cm]?[jt]sx?$/.test(b)) entries.add(f);
    if (f.startsWith("scripts/")) entries.add(f);
  }
  return [...entries];
}

// --------------------------------------------------------------------------
// non-code references
// --------------------------------------------------------------------------

/**
 * A large share of "unused" false positives are things invoked from somewhere
 * that is not code: a package script, a hook declaration in settings.json, a
 * plugin name in a config array. Searching those files converts a
 * `searchesNotRun` entry into a real search, which is the difference between a
 * candidate worth reading and noise.
 */
const TEXTY_EXT = new Set([
  ".json",
  ".jsonc",
  ".yml",
  ".yaml",
  ".toml",
  ".ini",
  ".md",
  ".html",
  ".sh",
  ".ps1",
  ".cfg",
  ".env",
  ".txt",
  ".xml",
]);

function nonCodeCorpus(root, files) {
  /** @type {{ file: string, text: string }[]} */
  const corpus = [];
  for (const f of files) {
    const ext = extname(f);
    if (!TEXTY_EXT.has(ext) && basename(f) !== "Dockerfile" && !basename(f).startsWith("."))
      continue;
    if (CODE_EXT.has(ext)) continue;
    try {
      const st = statSync(join(root, f));
      if (st.size > 2 * 1024 * 1024) continue; // a giant fixture is not a reference site
      corpus.push({ file: f, text: readFileSync(join(root, f), "utf8") });
    } catch {
      // unreadable — it simply contributes no references
    }
  }
  return corpus;
}

/** Where (if anywhere) a path or its stem is mentioned in a non-code file. */
function referencedIn(corpus, relPath) {
  const stem = basename(relPath, extname(relPath));
  const hits = [];
  for (const { file, text } of corpus) {
    if (file === relPath) continue;
    if (text.includes(relPath) || (stem.length >= 4 && text.includes(stem))) hits.push(file);
    if (hits.length >= 5) break;
  }
  return hits;
}

/**
 * Package names mentioned in package scripts or config files.
 *
 * `skipFiles` exists because of a defect this would otherwise have: the manifest
 * that DECLARES a dependency mentions it by definition, so scanning
 * `package.json` marks every unused dependency as "mentioned in config" and the
 * signal collapses to noise. A declaration is not evidence of use.
 */
function packagesMentionedOutsideCode(corpus, names, skipFiles = new Set()) {
  /** @type {Record<string, string[]>} */
  const out = {};
  for (const name of names) {
    const bin = name.startsWith("@") ? name.split("/")[1] : name;
    for (const { file, text } of corpus) {
      if (skipFiles.has(file)) continue;
      const mentioned =
        text.includes(`"${name}"`) ||
        new RegExp(`\\b${bin.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`).test(text);
      if (mentioned) (out[name] ??= []).push(file);
      if ((out[name]?.length ?? 0) >= 3) break;
    }
  }
  return out;
}

// --------------------------------------------------------------------------
// git
// --------------------------------------------------------------------------

function gitAnalysis(root, limitFiles) {
  const run = (args) =>
    execFileSync("git", args, {
      cwd: root,
      encoding: "utf8",
      maxBuffer: 128 * 1024 * 1024,
      stdio: ["ignore", "pipe", "ignore"],
    });
  try {
    // one pass over history: commit boundaries + changed paths
    const log = run(["log", "--pretty=format:%H", "--name-only", "--no-merges"]);
    /** @type {Record<string, number>} */
    const churn = {};
    /** @type {Record<string, number>} */
    const pairs = {};
    let current = [];
    const flush = () => {
      const files = [...new Set(current)].filter((f) => limitFiles.has(f));
      for (const f of files) churn[f] = (churn[f] ?? 0) + 1;
      if (files.length > 1 && files.length <= 25) {
        files.sort();
        for (let i = 0; i < files.length; i++)
          for (let j = i + 1; j < files.length; j++) {
            const k = `${files[i]} ${files[j]}`;
            pairs[k] = (pairs[k] ?? 0) + 1;
          }
      }
      current = [];
    };
    for (const line of log.split("\n")) {
      if (line === "") continue;
      if (/^[0-9a-f]{40}$/.test(line)) {
        flush();
        continue;
      }
      current.push(line);
    }
    flush();

    const topChurn = Object.entries(churn)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([file, commits]) => ({ file, commits }));
    const coChange = Object.entries(pairs)
      .filter(([, n]) => n >= 3)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15)
      .map(([k, n]) => {
        const [a, b] = k.split(" ");
        return { a, b, together: n };
      });
    const reverts = run(["log", "--oneline", "--grep=^Revert", "--no-merges"])
      .split("\n")
      .filter(Boolean).length;
    return { available: true, topChurn, coChange, revertCommits: reverts };
  } catch (err) {
    return { available: false, reason: `git history unavailable: ${err.message.split("\n")[0]}` };
  }
}

// --------------------------------------------------------------------------
// main
// --------------------------------------------------------------------------

/** @param {string} [rootArg] @param {{ useGit?: boolean }} [opts] */
export function runRepoInventory(rootArg, opts = {}) {
  const root = rootArg ?? findRepoRoot();
  const { config } = loadConfig(root);
  const useGit = opts.useGit !== false;

  const tracked = useGit ? gitTracked(root) : null;
  const allFiles = (tracked ?? walk(root, config)).filter(
    (f) =>
      !config.exclude.some((ex) => f === ex || f.startsWith(`${ex}/`) || f.includes(`/${ex}/`)),
  );
  const listing = tracked
    ? "git ls-files (respects .gitignore)"
    : "filesystem walk (git unavailable)";

  const pkgPath = join(root, "package.json");
  const pkg = existsSync(pkgPath) ? JSON.parse(readFileSync(pkgPath, "utf8")) : null;

  const codeFiles = allFiles.filter((f) => CODE_EXT.has(extname(f)));

  // --- import graph -------------------------------------------------------
  /** @type {Record<string, string[]>} */
  const edges = {};
  /** @type {Set<string>} */
  const computedImporters = new Set();
  /** @type {Record<string, Set<string>>} */
  const packageUse = {};
  /** @type {{ file: string, kind: string, line: number }[]} */
  const disabledTests = [];
  let unreadable = 0;

  for (const f of codeFiles) {
    let src;
    try {
      src = readFileSync(join(root, f), "utf8");
    } catch {
      unreadable++;
      continue;
    }
    const { specifiers, hasComputedImport } = extractImports(src);
    if (hasComputedImport) computedImporters.add(f);
    edges[f] = [];
    for (const spec of specifiers) {
      const local = resolveLocal(root, f, spec);
      if (local) {
        edges[f].push(local);
        continue;
      }
      if (spec.startsWith(".") || spec.startsWith("/")) continue;
      if (spec.startsWith("node:")) continue;
      const name = spec.startsWith("@")
        ? spec.split("/").slice(0, 2).join("/")
        : spec.split("/")[0];
      (packageUse[name] ??= new Set()).add(f);
    }

    if (/\.(test|spec)\.[cm]?[jt]sx?$/.test(f)) {
      src.split("\n").forEach((line, i) => {
        const m = /\b(?:it|test|describe)\.(skip|todo|only|failing)\b|\bx(?:it|describe)\s*\(/.exec(
          line,
        );
        if (m) disabledTests.push({ file: f, kind: m[1] ?? "x-prefixed", line: i + 1 });
      });
    }
  }

  // --- reachability -------------------------------------------------------
  const entries = entryPoints(root, codeFiles, pkg, allFiles);
  const reachable = new Set(entries);
  const queue = [...entries];
  while (queue.length) {
    const cur = queue.pop();
    for (const next of edges[cur] ?? []) {
      if (!reachable.has(next)) {
        reachable.add(next);
        queue.push(next);
      }
    }
  }

  const anyComputed = computedImporters.size > 0;
  const corpus = nonCodeCorpus(root, allFiles);
  const deletionCandidates = codeFiles
    .filter((f) => !reachable.has(f))
    .map((f) => {
      const risks = highRisk(f);
      const nonCodeRefs = referencedIn(corpus, f);
      const bytes = (() => {
        try {
          return statSync(join(root, f)).size;
        } catch {
          return 0;
        }
      })();
      return {
        file: f,
        bytes,
        whyUnused: "not reachable from any detected entry point via static imports",
        searchesRun: [
          "static import/require/export-from/literal-dynamic-import extraction over every code file",
          `entry-point set: package.json fields, tests, config files, conventional entry names, scripts/ (${entries.length} entries)`,
          `full-text search for the path and its stem across ${corpus.length} non-code files (config, manifests, docs, shell)`,
        ],
        searchesNotRun: [
          "computed or template-literal import specifiers",
          "references from outside this repository",
          "reflection, plugin registries, and runtime path construction",
        ],
        nonCodeReferences: nonCodeRefs,
        dynamicLoadingRisk: anyComputed
          ? `${computedImporters.size} file(s) in this repo use a non-literal import/require — any of them could reach this file invisibly`
          : "no non-literal import/require found in this repo, which raises but does not confirm confidence",
        highRiskReasons: risks,
        // A hit in a non-code file is the single strongest counter-evidence this
        // scan can produce: something names the file even though nothing imports
        // it. It never clears a high-risk path, but it does drop confidence to
        // the floor so the candidate reads as "probably in use".
        risk: risks.length || nonCodeRefs.length ? "high" : "medium",
        confidence: risks.length || nonCodeRefs.length ? "low" : "medium",
        proposedValidation: `remove it on a branch, run the detected gate, and grep the whole repo (including non-code files) for "${basename(f, extname(f))}"`,
      };
    })
    .sort((a, b) => b.bytes - a.bytes);

  // --- dependencies -------------------------------------------------------
  const declared = { ...(pkg?.dependencies ?? {}), ...(pkg?.devDependencies ?? {}) };
  const noImportSite = Object.keys(declared).filter((name) => !packageUse[name]);
  // `package.json`'s dependency block is the declaration itself, not a use of
  // it — but its `scripts` block IS a real use site, so scan that separately.
  const scriptsText = JSON.stringify(pkg?.scripts ?? {});
  const corpusForDeps = [
    { file: "package.json#scripts", text: scriptsText },
    ...corpus.filter((c) => c.file !== "package.json"),
  ];
  const mentioned = packagesMentionedOutsideCode(corpusForDeps, noImportSite);
  const unusedDependencies = noImportSite.map((name) => {
    const where = mentioned[name] ?? [];
    return {
      name,
      kind: pkg?.dependencies?.[name] ? "dependency" : "devDependency",
      whyUnused: "no static import of this package specifier in any scanned code file",
      mentionedOutsideCode: where,
      searchesRun: [
        "static import/require extraction over every code file",
        "full-text search for the package name and its bin name across package scripts and config files",
      ],
      searchesNotRun: [
        "usage as a peer of another package, or by a framework naming convention",
        "usage by a tool that resolves plugins implicitly (some eslint/babel presets)",
      ],
      confidence: where.length ? "low" : "medium",
      note: where.length
        ? `named in ${where.join(", ")} — almost certainly invoked as a binary or a config plugin, not imported`
        : "no import site and no mention in scripts or config; still verify before removing",
    };
  });

  // --- large / secret-bearing ---------------------------------------------
  const withSizes = allFiles.map((f) => {
    try {
      return { file: f, bytes: statSync(join(root, f)).size };
    } catch {
      return { file: f, bytes: 0 };
    }
  });
  const maxBytes = (config.limits?.max_file_size_mb ?? 10) * 1024 * 1024;
  const largeFiles = withSizes.filter((f) => f.bytes >= maxBytes).sort((a, b) => b.bytes - a.bytes);
  const secretBearingTracked = allFiles.filter(isSecretBearingPath);

  const git = useGit
    ? gitAnalysis(root, new Set(allFiles))
    : { available: false, reason: "git analysis disabled" };

  const result = {
    schema: "repo-cleanup/repo-inventory@1",
    root,
    generatedBy: "repo-inventory.mjs",
    method: {
      listing,
      importExtraction:
        "REGEX, not a parser — blind to computed specifiers, reflection, and non-code references",
      unreadableFiles: unreadable,
    },
    counts: {
      files: allFiles.length,
      codeFiles: codeFiles.length,
      entryPoints: entries.length,
      reachable: reachable.size,
      deletionCandidates: deletionCandidates.length,
    },
    entryPoints: entries,
    deletionCandidates,
    unusedDependencies,
    disabledTests,
    largeFiles,
    secretBearingTracked,
    computedImportFiles: [...computedImporters],
    git,
    measurementGaps: [
      "import extraction is regex-based; a file reached only by a computed specifier will be reported as a deletion candidate",
      `non-code reference search is full-text over ${corpus.length} files and can miss a reference built from string fragments`,
      unreadable > 0 ? `${unreadable} code file(s) could not be read and are excluded` : null,
      git.available ? null : git.reason,
    ].filter(Boolean),
  };

  result.observations = buildObservations(result);
  return result;
}

function buildObservations(r) {
  const obs = [];
  const push = (code, statement, data) => obs.push({ code, statement, data });

  push("REPO.counts", "file and reachability counts", r.counts);

  if (r.deletionCandidates.length) {
    push("REPO.deletion-candidates", "files not reachable from any detected entry point", {
      total: r.deletionCandidates.length,
      highRisk: r.deletionCandidates.filter((c) => c.risk === "high").length,
      likelyInUse: r.deletionCandidates.filter((c) => c.nonCodeReferences.length > 0).length,
      top: r.deletionCandidates.slice(0, 10).map((c) => ({
        file: c.file,
        bytes: c.bytes,
        risk: c.risk,
        nonCodeReferences: c.nonCodeReferences,
      })),
    });
  }
  if (r.unusedDependencies.length) {
    push("REPO.unused-dependencies", "declared packages with no static import site", {
      total: r.unusedDependencies.length,
      noMentionAnywhere: r.unusedDependencies
        .filter((d) => d.mentionedOutsideCode.length === 0)
        .map((d) => d.name),
      mentionedInScriptsOrConfig: r.unusedDependencies
        .filter((d) => d.mentionedOutsideCode.length > 0)
        .map((d) => d.name),
    });
  }
  if (r.disabledTests.length) {
    const only = r.disabledTests.filter((t) => t.kind === "only");
    push("REPO.disabled-tests", "skipped, todo, failing or focused tests", {
      total: r.disabledTests.length,
      focusedOnly: only.length,
      note: only.length ? "a `.only` silently disables every OTHER test in its file" : undefined,
      entries: r.disabledTests.slice(0, 20),
    });
  }
  if (r.largeFiles.length)
    push("REPO.large-files", "tracked files over the configured size limit", r.largeFiles);
  if (r.secretBearingTracked.length) {
    push(
      "REPO.secret-bearing-tracked",
      "credential-shaped paths present in the file listing (NOT opened)",
      {
        paths: r.secretBearingTracked,
        note: "detected by filename only; contents were never read",
      },
    );
  }
  if (r.git.available) {
    push("GIT.churn", "most frequently modified files", r.git.topChurn);
    if (r.git.coChange.length)
      push("GIT.co-change", "files that change together (3+ commits)", r.git.coChange);
    push("GIT.reverts", 'commits whose subject starts with "Revert"', {
      count: r.git.revertCommits,
    });
  }
  return obs;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const i = process.argv.indexOf("--root");
  const out = runRepoInventory(i === -1 ? undefined : process.argv[i + 1], {
    useGit: !process.argv.includes("--no-git"),
  });
  process.stdout.write(`${JSON.stringify(out, null, 2)}\n`);
}
