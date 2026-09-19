#!/usr/bin/env node
/**
 * release-smoke.mjs — the POST-RELEASE fresh-install smoke (#106, #71).
 *
 * A pushed tag is not a release, and `npm view` is not an install. The previous
 * post-release step asked the registry whether a version RESOLVES and whether the
 * Release page carries the expected asset names — both true for a package whose
 * tarball is empty, whose `exports` point at files the tarball does not contain,
 * or that cannot be installed at all with the auth a consumer has. `consumer:check`
 * covers the artifact, but it installs LOCAL tarballs before the publish; nothing
 * ever installed the PUBLISHED thing from the registry.
 *
 * So this does what the runbook tells a consumer to do, in a scratch directory
 * OUTSIDE the workspace:
 *
 *   1. `npm install` every published package at the released version, from the
 *      registry, with a consumer-shaped `.npmrc` (scope → registry + auth).
 *   2. Resolve each installed package's `exports["."]` entry and assert the file
 *      is really in the tarball and non-empty — the check `npm view` cannot make.
 *   3. `import()` the published CLI (pure Node ESM — a real import of a real
 *      published artifact) and run its consumer commands (`info --json`, `docs`)
 *      from the installed `bin`.
 *   4. Assert the plugin pointer a `/plugin marketplace add` consumer follows —
 *      `.claude-plugin/marketplace.json` as served by the repo's DEFAULT BRANCH,
 *      read back over the GitHub API — names the released version.
 *
 * TWO THINGS THIS GETS RIGHT THAT AN EARLIER CUT DID NOT, both of which made the
 * step worthless in exactly the way it exists to prevent:
 *
 *   - **The registry is mapped PER SCOPE, never globally.** A process-wide
 *     `npm install --registry=https://npm.pkg.github.com` makes GitHub Packages the
 *     default for every TRANSITIVE dependency too, and GitHub Packages does not
 *     proxy npmjs.org — so the install dies on the first public dep
 *     (`E404 … GET https://npm.pkg.github.com/@hookform%2fresolvers`) and the smoke
 *     fails EVERY release, after the irreversible publish. The scoped `.npmrc`
 *     `consumerNpmrc()` writes is what docs/CONSUMING.md tells a consumer to use,
 *     and is exactly enough: `@scope:registry=…` + the auth line.
 *   - **The marketplace pointer is read from the DEFAULT BRANCH, not this checkout.**
 *     Reading the tag's own working tree is tautological: the `version-sync` check in the
 *     same job already asserted that file agrees with the root version. A
 *     `/plugin marketplace add <path-to-this-repo>` consumer follows
 *     `main` — so if `git push origin main` was skipped, or the version commit was
 *     later reverted, consumers keep the OLD plugin while a working-tree check stays
 *     green. The local read survives only as an offline fallback, and says so.
 *
 * NOT covered, deliberately and in writing: `npx shadcn add`. The shadcn registry
 * is not built, published or hosted by a release (docs/REGISTRY_GUIDELINES.md,
 * docs/RELEASING.md § 5) — consumers self-host it — so there is no registry URL a
 * release could smoke-test. `brand-ui context` is monorepo-only (it writes this
 * repo's CLAUDE.md/AGENTS.md); the consumer-facing equivalents are `info`/`docs`,
 * which is what step 3 runs.
 *
 * STEP 4 IS ALSO AVAILABLE ON ITS OWN, BEFORE THE PUBLISH (`--pointer-only`,
 * run as `node scripts/release-smoke.mjs --pointer-only`). The pointer check is the one assertion here
 * that needs nothing the publish produces — `resolveMarketplacePointer` is two
 * `gh api` calls against the default branch — so running it only after publishing
 * would discover "the tag was pushed without `git push origin main`" once twelve
 * immutable npm versions already exist. release.yml therefore runs it as a
 * publish-only preflight AND keeps it inside the post-release smoke: the
 * preflight is what saves the release, the smoke is what proves the end state.
 *
 * STEP 5 IS THE DEPLOYED DOCS SITE (`--stories-only`), and it belongs to the docs
 * job, not this one: it crawls the Storybook that was JUST deployed. On
 * 2026-09-17 the live site was serving 26 chart stories that drew nothing and
 * several whose play functions threw, with a green CI — because nothing in the
 * pipeline had ever opened the published Storybook. It loads every story from
 * the site's own `index.json` in Chromium and fails on a visible error overlay,
 * an uncaught page error, or a chart that measured to nothing
 * (scripts/lib/story-crawl.mjs). It needs a Chromium: `pnpm --filter
 * @elabs-ai/components-docs exec playwright install --with-deps chromium`.
 *
 *   pnpm release:smoke                        # every distributable package at the root version
 *   node scripts/release-smoke.mjs --pointer-only  # ONLY step 4, safe to run before the publish
 *   node scripts/release-smoke.mjs --stories-only  # ONLY step 5, against the deployed site
 *   node scripts/release-smoke.mjs --version 2.0.0 --manifest <path> --registry <url>
 *
 * Flags:
 *   --pointer-only    run ONLY the marketplace-pointer assertion (no install, no
 *                     package list needed) — the pre-publish preflight
 *   --stories-only    run ONLY the published-story crawl (no install, no registry)
 *   --stories <url>   the Storybook to crawl (default: https://elabs-ai.com)
 *   --concurrency <n> pages open at once during the crawl (default: 8)
 *   --version <v>     released version (default: the root package.json version)
 *   --manifest <p>    JSON package list to install instead of the derived distributables
 *   --registry <url>  registry the RELEASE SCOPES map to in the generated `.npmrc`
 *                     (default: https://npm.pkg.github.com). Never the process-wide
 *                     default — public deps must still resolve from npmjs.org.
 *   --repo <o/r>      GitHub repo whose default branch serves the marketplace
 *                     pointer (default: $GITHUB_REPOSITORY)
 *   --scratch <dir>   use this scratch dir instead of a fresh mkdtemp
 *   --keep            do not delete the scratch dir (debugging)
 *   --root <dir>      repo root (default: this file's repo)
 *
 * Dependency-free; ESM; cwd-independent.
 */
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { REPO_ROOT, distributablePackages } from "./lib/distributables.mjs";
import { crawlStories, storiesFromIndex } from "./lib/story-crawl.mjs";

/**
 * Where a release lands by default — the PUBLIC npm registry.
 *
 * Was `https://npm.pkg.github.com` while the packages were private. The smoke
 * still writes a per-scope mapping rather than relying on npm's built-in default
 * (see `consumerNpmrc`), so the shape it exercises stays identical if the target
 * ever moves back to a private host; only the value changed.
 */
export const DEFAULT_REGISTRY = "https://registry.npmjs.org/";

/**
 * The package names a package list records — `{ packages: [{ name }] }` or a bare
 * `[{ name, version }]` array (changesets/action's `published-packages`). Pure.
 */
export function packagesFromManifest(manifest) {
  const rows = Array.isArray(manifest) ? manifest : manifest?.packages;
  if (!Array.isArray(rows) || rows.length === 0) return [];
  return rows.map((p) => p.name).filter(Boolean);
}

/**
 * The `.npmrc` a CONSUMER writes: each RELEASE SCOPE resolves to the release
 * registry, plus an auth line when a `token` is supplied. Derived from the
 * package names so a new scope needs no edit here. Pure.
 *
 * Deliberately per-scope (`@scope:registry=…`) and never a bare `registry=…`
 * default. On the public registry that mapping is redundant at install time —
 * npmjs.org is already npm's default — but writing it keeps the smoke exercising
 * the shape a PRIVATE target requires, where a process-wide default would send
 * every transitive dependency to a host that does not proxy npmjs and 404s them.
 * `token` is likewise kept: unused for a public release, and the only thing that
 * makes this reusable the day a scope goes private again.
 */
export function consumerNpmrc(names, { registry = DEFAULT_REGISTRY, token } = {}) {
  const scopes = [...new Set(names.map((n) => n.split("/")[0]).filter((s) => s.startsWith("@")))];
  const host = registry.replace(/^https?:/, "");
  const lines = scopes.map((s) => `${s}:registry=${registry}`);
  if (token) lines.push(`${host.replace(/\/$/, "")}/:_authToken=${token}`);
  return lines.join("\n") + "\n";
}

/**
 * The install argv a fresh consumer runs. Pure — exported for the self-test.
 *
 * NO `--registry` flag, by construction: it is a PROCESS-WIDE default, so it
 * would send every public transitive dependency to GitHub Packages, which 404s
 * them. The scope→registry mapping belongs in the `.npmrc` (`consumerNpmrc`),
 * which is also what a real consumer writes. The self-test asserts the absence.
 */
export function installArgs(names, version) {
  return ["install", "--no-audit", "--no-fund", ...names.map((n) => `${n}@${version}`)];
}

/**
 * Resolve one installed package's `exports["."]` entry to a file path.
 * Returns `{ name, dir, entry, error }` — `error` is set when the package is not
 * installed, or when its entry names a file the tarball does not contain (the
 * defect `npm view` cannot see). Pure apart from the fs reads.
 */
export function resolveInstalledEntry(scratchDir, name) {
  const dir = join(scratchDir, "node_modules", ...name.split("/"));
  const pj = join(dir, "package.json");
  if (!existsSync(pj)) return { name, dir, entry: null, error: "not installed" };
  let json;
  try {
    json = JSON.parse(readFileSync(pj, "utf8"));
  } catch {
    return { name, dir, entry: null, error: "package.json is not valid JSON" };
  }
  const dot = json.exports?.["."] ?? json.exports;
  const rel =
    (typeof dot === "string" ? dot : (dot?.import ?? dot?.default ?? dot?.require)) ??
    json.module ??
    json.main;
  if (!rel) {
    // A bin-only package (the CLI) legitimately has no "." export.
    if (json.bin) return { name, dir, entry: null, error: null };
    return { name, dir, entry: null, error: "declares no entry point" };
  }
  const entry = join(dir, rel);
  if (!existsSync(entry)) {
    return { name, dir, entry, error: `entry ${rel} is missing from the published tarball` };
  }
  if (statSync(entry).size === 0) {
    return { name, dir, entry, error: `entry ${rel} is empty in the published tarball` };
  }
  return { name, dir, entry, error: null };
}

/** Every installed package's entry check. Pure apart from the fs reads. */
export function checkInstalledEntries(scratchDir, names) {
  return names.map((n) => resolveInstalledEntry(scratchDir, n));
}

/** The plugin version inside a `marketplace.json` body. Pure. */
export function parseMarketplaceVersion(text) {
  return String(text).match(/"version":\s*"([^"]+)"/)?.[1] ?? null;
}

/**
 * The plugin pointer in THIS checkout. On the release path that is the tag's own
 * tree, which the `version-sync` check has already vouched for — so it is the
 * OFFLINE FALLBACK, not the assertion. See `resolveMarketplacePointer`.
 */
export function marketplaceVersion(root) {
  const p = join(root, ".claude-plugin", "marketplace.json");
  if (!existsSync(p)) return null;
  return parseMarketplaceVersion(readFileSync(p, "utf8"));
}

/** Run `gh` and return stdout. Replaced in the self-test. */
function runGh(args) {
  return execFileSync("gh", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
}

/**
 * The pointer a `/plugin marketplace add <owner>/<repo>` consumer ACTUALLY
 * follows: `.claude-plugin/marketplace.json` as served by the repo's **default
 * branch**, fetched over the GitHub API.
 *
 * Why not the working tree: on a `v*` tag run the tree is the tag's, and the same
 * job's `version-sync` check already asserted that file equals the root version —
 * so comparing it to the released version is unfalsifiable. `main` is a different
 * ref: RELEASING.md § 4 pushes `main` and the tag as two separate commands, and a
 * revert can move `main` afterwards. Both leave consumers on the previous plugin
 * while a working-tree read stays green.
 *
 * Returns `{ version, source: "default-branch" | "worktree", ref, error }`.
 * `gh` is injected so the self-test drives it without a network.
 */
export function resolveMarketplacePointer({ root, repo, gh = runGh } = {}) {
  if (repo) {
    try {
      const ref = gh(["api", `repos/${repo}`, "--jq", ".default_branch"]).trim();
      if (!ref) throw new Error("the repo reports no default branch");
      const b64 = gh([
        "api",
        `repos/${repo}/contents/.claude-plugin/marketplace.json?ref=${ref}`,
        "--jq",
        ".content",
      ]);
      const text = Buffer.from(b64.replace(/\s+/g, ""), "base64").toString("utf8");
      const version = parseMarketplaceVersion(text);
      if (!version) {
        return {
          version: null,
          source: "default-branch",
          ref,
          error: `${ref}'s .claude-plugin/marketplace.json declares no "version"`,
        };
      }
      return { version, source: "default-branch", ref, error: null };
    } catch (err) {
      return {
        version: marketplaceVersion(root),
        source: "worktree",
        ref: null,
        error: `could not read the pointer from ${repo}'s default branch — ${err.message.trim().split("\n")[0]}`,
      };
    }
  }
  return {
    version: marketplaceVersion(root),
    source: "worktree",
    ref: null,
    error: "no repo given (set --repo or $GITHUB_REPOSITORY) — cannot reach the default branch",
  };
}

/**
 * Judge a resolved pointer against the version being released. Pure — exported so
 * both the preflight and the post-release smoke share ONE verdict, and the
 * self-test can drive every branch without a network.
 *
 * Returns `{ failures, logs, warnings }`. The CI branch matters: falling back to
 * the working tree there would re-create the tautology this check exists to kill
 * (the `version-sync` check already forced the tag's own copy to agree), so an
 * unresolvable pointer is a failure under CI and a loud warning locally.
 */
export function judgeMarketplacePointer({ pointer, version, repo, ci = Boolean(process.env.CI) }) {
  const failures = [];
  const logs = [];
  const warnings = [];
  const where =
    pointer.source === "default-branch"
      ? `${repo}@${pointer.ref}`
      : "this checkout (offline fallback)";

  if (pointer.version !== version) {
    failures.push(
      `.claude-plugin/marketplace.json on ${where} serves ${pointer.version ?? "(unreadable)"}, ` +
        `not ${version} — a \`/plugin marketplace add\` consumer would still get the previous ` +
        "plugin. Did `git push origin main` run before the tag, or was the release commit reverted?",
    );
  } else if (pointer.source === "default-branch") {
    logs.push(`marketplace.json on ${where} serves ${version}`);
  } else if (ci) {
    failures.push(
      `the marketplace pointer could not be verified against the default branch — ${pointer.error}. ` +
        "The local read agrees, but the `version-sync` check already asserted that, so it proves nothing.",
    );
  } else {
    warnings.push(
      `marketplace.json read from ${where}: ${pointer.error}.\n` +
        "      This is TAUTOLOGICAL on a tag checkout (the version-sync check already asserts it) — pass\n" +
        "      --repo <owner>/<name> with `gh` authenticated to check the branch consumers follow.",
    );
  }
  return { failures, logs, warnings };
}

/** The Storybook a release deploys — the address a customer opens. */
export const DEFAULT_STORIES_URL = "https://elabs-ai.com";

/**
 * The one-line verdict of a story crawl. Pure, so the wording is pinned by the
 * self-test rather than by reading CI logs.
 */
export function summariseCrawl({ visited, failures }, base) {
  if (failures.length === 0)
    return `✔ release:smoke: ${visited} published stories at ${base} render — no error overlay, no page error, every chart drew something.`;
  const lines = [
    `✖ release:smoke: ${failures.length} of ${visited} published stories at ${base} are broken for a visitor:`,
  ];
  for (const f of failures) for (const p of f.problems) lines.push(`  - ${f.id}  ${p}`);
  return lines.join("\n");
}

/**
 * Playwright's entry point is CommonJS, and its `module.exports` is built at
 * runtime, so Node's named-export detection finds nothing: `import("playwright")`
 * hands back a namespace whose only real member is `default`. Reading
 * `.chromium` off it gives `undefined`, and the first crawl died on
 * "Cannot read properties of undefined (reading 'launch')" AFTER printing
 * "crawling 1958 stories" — a failure that looks like a broken site. Take the
 * browser from whichever shape the namespace has.
 */
export function pickChromium(mod) {
  return mod?.chromium ?? mod?.default?.chromium;
}

/**
 * Step 5 — open every story the deployed site serves. Returns an exit code.
 *
 * `launch` is injected so the self-test drives it without a browser; by default
 * it is Playwright's Chromium, resolved from the workspace (this script is
 * dependency-free, so the import is lazy and its absence is a clear message
 * rather than a module-load crash).
 */
export async function smokeStories({
  base = DEFAULT_STORIES_URL,
  concurrency = 8,
  root = REPO_ROOT,
  launch,
  log = console.log,
  error = console.error,
} = {}) {
  let index;
  try {
    const res = await fetch(`${String(base).replace(/\/+$/, "")}/index.json`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    index = await res.json();
  } catch (err) {
    error(`✖ release:smoke: cannot read ${base}/index.json — ${err.message}`);
    return 1;
  }
  const entries = storiesFromIndex(index);
  if (entries.length === 0) {
    error(
      `✖ release:smoke: ${base}/index.json lists ZERO stories — the crawl would pass vacuously.`,
    );
    return 1;
  }

  let open = launch;
  if (!open) {
    // Playwright is apps/docs's devDependency (the Storybook Vitest browser
    // runner owns it), not the root's, so resolve it from there rather than
    // from this file — pnpm does not hoist it to the repo root.
    const from = pathToFileURL(join(root, "apps", "docs", "package.json")).href;
    let chromium;
    try {
      const resolved = createRequire(from).resolve("playwright");
      chromium = pickChromium(await import(pathToFileURL(resolved).href));
    } catch {
      chromium = undefined;
    }
    if (!chromium) {
      error(
        "✖ release:smoke: playwright is not installed — run `pnpm --filter " +
          "@elabs-ai/components-docs exec playwright install --with-deps chromium`.",
      );
      return 1;
    }
    open = () => chromium.launch();
  }

  log(`  crawling ${entries.length} stories at ${base} (${concurrency} at a time) …`);
  const browser = await open();
  try {
    const result = await crawlStories({ browser, base, entries, concurrency, log });
    const summary = summariseCrawl(result, base);
    if (result.failures.length > 0) {
      error(summary);
      return 1;
    }
    log(summary);
    return 0;
  } finally {
    await browser.close();
  }
}

// ──────────────────────────────── CLI ─────────────────────────────────────────
// ── The advertised surface (2026-09-18 review) ──────────────────────────────────
// Two failures this pipeline could not see, both measured on the live system:
//   - llms.txt / README on `main` advertised `npx -y @elabs-ai/components-cli create`
//     while the PUBLISHED 4.2.0 CLI answered "Unknown command: create";
//   - https://elabs-ai.com/llms.txt still told agents to install from GitHub
//     Packages, days after the generator was fixed, because the site deploys on
//     release and nothing compared what is served with what was released.
// An agent follows the front door literally. So: every verb the front door
// advertises must exist in the published CLI, and the deployed front door must be
// byte-identical to the one this release generated.

/** CLI verbs a document tells a reader to run — read from code spans and fences only,
 *  so prose like "brand-ui ships …" never counts. */
export function advertisedVerbs(text) {
  const code = [
    ...String(text).matchAll(/```[\s\S]*?```/g),
    ...String(text).matchAll(/`[^`\n]+`/g),
  ].map((m) => m[0]);
  const verbs = new Set();
  for (const span of code)
    for (const m of span.matchAll(
      /(?:components-cli(?:@[\w.^~-]+)?|(?<![\w/@-])brand-ui)[ \t]+([a-z][a-z0-9-]*)(?![\w:./@-])/g,
    ))
      verbs.add(m[1]);
  return [...verbs].sort();
}

/** The verbs a CLI's own `--help` lists (two-space indented first column). */
export function helpVerbs(helpText) {
  return [
    ...new Set([...String(helpText).matchAll(/^ {2}([a-z][a-z0-9-]*)\b/gm)].map((m) => m[1])),
  ].sort();
}

/** Advertised-but-missing verbs. `help` is always available. */
export function missingVerbs(advertised, available) {
  const have = new Set([...available, "help"]);
  return advertised.filter((v) => !have.has(v));
}

/** The files whose commands a newcomer or an agent runs verbatim. */
export const FRONT_DOOR_FILES = [
  "README.md",
  "apps/docs/public/llms.txt",
  "packages/cli/README.md",
];

/**
 * Post-deploy: is the served front door the one this release generated?
 * @returns {Promise<string[]>} failures
 */
export async function smokeFrontDoor({ root, base, fetchImpl = globalThis.fetch }) {
  const failures = [];
  const origin = String(base).replace(/\/+$/, "");
  const local = join(root, "apps", "docs", "public", "llms.txt");
  try {
    const res = await fetchImpl(`${origin}/llms.txt`);
    if (!res.ok) failures.push(`${origin}/llms.txt → HTTP ${res.status}`);
    else if (existsSync(local) && (await res.text()).trim() !== readFileSync(local, "utf8").trim())
      failures.push(
        `${origin}/llms.txt differs from apps/docs/public/llms.txt at this release — ` +
          "agents are reading a stale front door (deploy did not pick up the generated file)",
      );
  } catch (err) {
    failures.push(`${origin}/llms.txt → ${err.message}`);
  }
  for (const path of ["/.well-known/mcp.json"]) {
    if (!existsSync(join(root, "apps", "docs", "public", ...path.split("/").filter(Boolean))))
      continue;
    try {
      const res = await fetchImpl(`${origin}${path}`);
      if (!res.ok) failures.push(`${origin}${path} → HTTP ${res.status} (llms.txt advertises it)`);
    } catch (err) {
      failures.push(`${origin}${path} → ${err.message}`);
    }
  }
  return failures;
}

function argValue(argv, flag) {
  const i = argv.indexOf(flag);
  return i >= 0 ? argv[i + 1] : undefined;
}

async function main(argv) {
  const root = argValue(argv, "--root") ?? REPO_ROOT;
  const registry = argValue(argv, "--registry") ?? DEFAULT_REGISTRY;
  const repo = argValue(argv, "--repo") ?? process.env.GITHUB_REPOSITORY;
  const rootPkgPath = join(root, "package.json");
  if (!existsSync(rootPkgPath)) {
    console.error(`✖ release:smoke: no package.json at ${root}`);
    return 1;
  }
  const version =
    argValue(argv, "--version") ?? JSON.parse(readFileSync(rootPkgPath, "utf8")).version;

  // ── The pre-publish preflight (`--pointer-only`) ─────────────────────────────
  // Everything else here needs the publish to have happened; this does not. Run
  // it while a fix is still "push main and re-tag" rather than 12 burnt versions.
  if (argv.includes("--pointer-only")) {
    const verdict = judgeMarketplacePointer({
      pointer: resolveMarketplacePointer({ root, repo }),
      version,
      repo,
    });
    for (const l of verdict.logs) console.log(`  ok  ${l}`);
    for (const w of verdict.warnings) console.warn(`  !   ${w}`);
    if (verdict.failures.length > 0) {
      console.error("✖ marketplace:check: the plugin pointer does not name this version:");
      for (const f of verdict.failures) console.error("  - " + f);
      console.error(
        "\n  Fix BEFORE the publish: `git push origin main`, then re-push the tag " +
          "(docs/RELEASING.md § 4).",
      );
      return 1;
    }
    console.log(
      `✔ marketplace:check: the pointer a \`/plugin marketplace add\` consumer follows names v${version}.`,
    );
    return 0;
  }

  // ── The post-deploy story crawl (`--stories-only`) ───────────────────────────
  // Belongs to the docs job: it looks at the Storybook that was just deployed,
  // which is the artefact no other step in this pipeline had ever opened.
  if (argv.includes("--stories-only")) {
    const base = argValue(argv, "--stories") ?? DEFAULT_STORIES_URL;
    const doorFailures = await smokeFrontDoor({ root, base });
    for (const f of doorFailures) console.error(`  ✖  ${f}`);
    if (!doorFailures.length) console.log(`  ok  ${base}/llms.txt is this release's front door`);
    const crawl = await smokeStories({
      root,
      base,
      concurrency: Number(argValue(argv, "--concurrency") ?? 8),
    });
    return doorFailures.length ? 1 : crawl;
  }

  // The package set is DERIVED, never retyped: the workspace's distributables by
  // default, or an explicit list (`--manifest`: a JSON file holding either
  // `{ packages: [{ name }] }` or changesets/action's `published-packages` array).
  const manifestPath = argValue(argv, "--manifest");
  if (manifestPath && !existsSync(manifestPath)) {
    console.error(`✖ release:smoke: no package list at ${manifestPath}.`);
    return 1;
  }
  const names = manifestPath
    ? packagesFromManifest(JSON.parse(readFileSync(manifestPath, "utf8")))
    : distributablePackages(root).map((p) => p.name);
  if (names.length === 0) {
    console.error(
      "✖ release:smoke: the package set names ZERO packages — the smoke would pass " +
        "vacuously by installing nothing.",
    );
    return 1;
  }

  const scratch = argValue(argv, "--scratch") ?? mkdtempSync(join(tmpdir(), "brand-ui-smoke-"));
  const keep = argv.includes("--keep");
  const failures = [];
  try {
    writeFileSync(
      join(scratch, "package.json"),
      JSON.stringify({ name: "brand-ui-release-smoke", private: true, type: "module" }, null, 2) +
        "\n",
    );
    writeFileSync(
      join(scratch, ".npmrc"),
      consumerNpmrc(names, { registry, token: process.env.NODE_AUTH_TOKEN }),
    );

    console.log(
      `  installing ${names.length} package(s) @ ${version} — release scopes from ${registry}, ` +
        "public deps from the default registry …",
    );
    try {
      execFileSync("npm", installArgs(names, version), {
        cwd: scratch,
        stdio: "pipe",
        encoding: "utf8",
      });
    } catch (err) {
      const detail = `${err.stderr ?? ""}${err.stdout ?? ""}`
        .trim()
        .split("\n")
        .slice(-8)
        .join("\n");
      failures.push(`fresh install failed:\n${detail}`);
      throw new SmokeFailed(failures);
    }

    for (const row of checkInstalledEntries(scratch, names)) {
      if (row.error) failures.push(`${row.name}: ${row.error}`);
      else console.log(`  ok  ${row.name}${row.entry ? "" : " (bin-only)"}`);
    }

    // A real import of a real published artifact. The CLI is pure Node ESM, so it
    // imports without a bundler — the component packages are covered by their
    // entry-resolution check above plus the pre-publish `consumer:check` build.
    const cli = names.find((n) => n.endsWith("-cli"));
    if (cli) {
      const cliDir = join(scratch, "node_modules", ...cli.split("/"));
      const bin = join(cliDir, "bin", "brand-ui.mjs");
      if (!existsSync(bin)) {
        failures.push(`${cli}: bin/brand-ui.mjs is missing from the published tarball`);
      } else {
        try {
          await import(pathToFileURL(join(cliDir, "lib", "core.mjs")).href);
          console.log(`  ok  import ${cli}/lib/core.mjs`);
        } catch (err) {
          failures.push(`${cli}: importing the published module failed — ${err.message}`);
        }
        // Every verb the front door tells a reader to run must exist in the CLI
        // that was just PUBLISHED — not merely in this checkout.
        try {
          const help = execFileSync("node", [bin, "--help"], { cwd: scratch, encoding: "utf8" });
          const advertised = advertisedVerbs(
            FRONT_DOOR_FILES.map((f) => join(root, f))
              .filter((f) => existsSync(f))
              .map((f) => readFileSync(f, "utf8"))
              .join("\n"),
          );
          const missing = missingVerbs(advertised, helpVerbs(help));
          if (missing.length)
            failures.push(
              `${cli}: the front door advertises \`brand-ui ${missing.join("`, `brand-ui ")}\` ` +
                "but the published CLI has no such command",
            );
          else
            console.log(
              `  ok  all ${advertised.length} advertised CLI verbs exist in the published CLI`,
            );
        } catch (err) {
          failures.push(`${cli}: \`brand-ui --help\` failed — ${err.message}`);
        }
        for (const probe of [
          ["info", "--json"],
          ["docs", "Button"],
        ]) {
          try {
            execFileSync("node", [bin, ...probe], { cwd: scratch, stdio: "pipe" });
            console.log(`  ok  brand-ui ${probe.join(" ")}`);
          } catch (err) {
            failures.push(`${cli}: \`brand-ui ${probe.join(" ")}\` failed — ${err.message}`);
          }
        }
      }
    }

    // The pointer a plugin consumer follows lives on the DEFAULT BRANCH, not on
    // the tag this job checked out (see resolveMarketplacePointer). Checked
    // after the publish: a revert can land on the default branch between the
    // version bump and this job.
    const verdict = judgeMarketplacePointer({
      pointer: resolveMarketplacePointer({ root, repo }),
      version,
      repo,
    });
    failures.push(...verdict.failures);
    for (const l of verdict.logs) console.log(`  ok  ${l}`);
    for (const w of verdict.warnings) console.warn(`  !   ${w}`);

    if (failures.length > 0) throw new SmokeFailed(failures);
  } catch (err) {
    if (!(err instanceof SmokeFailed)) failures.push(err.message);
    console.error(`✖ release:smoke: the published release does not install cleanly:`);
    for (const f of failures) console.error("  - " + f);
    console.error(
      "\n  This runs AFTER publish, so the fix is forward: see docs/RELEASING.md § 7 Rollback.",
    );
    return 1;
  } finally {
    if (!keep && !argValue(argv, "--scratch")) rmSync(scratch, { recursive: true, force: true });
    else console.log(`  scratch dir kept at ${scratch}`);
  }

  console.log(
    `✔ release:smoke: v${version} — ${names.length} package(s) installed fresh from ${registry} ` +
      "(scoped, public deps from npmjs.org), every entry present, the CLI imports and runs, " +
      "the marketplace pointer agrees.",
  );
  return 0;
}

/** Internal control-flow marker so the CLI reports the collected failures once. */
class SmokeFailed extends Error {}

if (import.meta.url === `file://${process.argv[1]}`) {
  process.exit(await main(process.argv.slice(2)));
}
