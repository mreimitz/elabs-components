#!/usr/bin/env node
/**
 * check-components-registered.mjs — WP-10 #86 component-registration gate.
 *
 * "Adding a component should never require remembering to register it." This is
 * the loud backstop, regardless of how a component was added (scaffold, hand, or
 * a different agent). It complements check-package-registered.sh (packages) with
 * a component-level sibling, and is wired into CI (`pnpm components:check`) + a
 * PostToolUse hook.
 *
 * BLOCKING (exit 1) — the crisp, unambiguous conventions:
 *   • @elabs-ai/components-ui folder-per-component: every `packages/ui/src/components/<name>/`
 *     MUST be re-exported from the package barrel (`src/index.ts`). An unexported
 *     component folder is invisible to consumers and to the manifest/MCP agent path.
 *   • STORY RATCHET (#67 DoD): a registered `@elabs-ai/components-ui` component with no
 *     co-located `*.stories.tsx` (and none in apps/docs) is invisible to the
 *     Storybook-MCP agent path. The pre-existing gaps are frozen in
 *     `scripts/components-story-baseline.json`; a NEW component without a story
 *     FAILS. The baseline only ratchets DOWN — `--update` after a cleanup. This is
 *     what makes "a component without its story fails a gate" true today instead of
 *     "after WP-02"; a repo-wide sweep is NOT required to get the teeth.
 *
 * ADVISORY (warn, never blocks):
 *   • a flat-file package (`@elabs-ai/components-ai`, charts, …) top-level `*.tsx` whose exports
 *     don't reach the manifest (possible orphan) — flat layout is fuzzier, so warn.
 *   • the `*.test.tsx` arm stays advisory-by-design: the quality-gates rule asks for a
 *     smoke test "where practical", and repo-wide test coverage is tracked separately
 *     (#59). Barrel + story + manifest are the machine-checkable three.
 *
 * Ignore convention: a source file/dir whose name starts with `_`, or a file whose
 * first lines contain `@registry-ignore`, is skipped (intentional internal-only).
 *
 * Self-tested by scripts/check-components-registered.test.mjs (`pnpm components:check:test`),
 * which drives the pure ratchet helper below.
 */
import { readdirSync, existsSync, readFileSync, writeFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { findRepoRoot, generateManifest } from "../packages/cli/lib/core.mjs";

/** Where the frozen list of pre-existing story gaps lives (repo-relative). */
export const STORY_BASELINE = "scripts/components-story-baseline.json";

/**
 * The pure ratchet: compare the components that are missing a story against the
 * frozen baseline. Driven by already-collected data so the self-test is hermetic.
 *
 * @param {object} input
 * @param {string[]} input.missing   component folder names with no story today
 * @param {string[]} input.baseline  the frozen, known-missing names
 * @returns {{ regressions: string[], stale: string[] }}
 *   `regressions` = new gaps (BLOCKING); `stale` = baseline entries that now have a
 *   story and should be ratcheted out (advisory — never a failure).
 */
export function findStoryRegressions({ missing, baseline }) {
  const frozen = new Set(baseline);
  const now = new Set(missing);
  return {
    regressions: missing.filter((n) => !frozen.has(n)).sort(),
    stale: [...frozen].filter((n) => !now.has(n)).sort(),
  };
}

/** The scan + report. Only runs when the script is invoked directly. */
function runGate({ update = false } = {}) {
  const root = findRepoRoot(process.cwd());
  if (!root) {
    console.error("check-components-registered: must run inside the brand-ui monorepo.");
    process.exit(1);
  }

  const blocking = [];
  const advisory = [];

  // All exported names the manifest knows about, per package (recursively).
  const manifest = generateManifest(root);
  function collectNames(node, out) {
    if (node == null) return out;
    if (typeof node === "string") {
      out.add(node);
    } else if (Array.isArray(node)) {
      for (const v of node) collectNames(v, out);
    } else if (typeof node === "object") {
      if (typeof node.name === "string") out.add(node.name);
      for (const k of Object.keys(node)) if (k !== "path") collectNames(node[k], out);
    }
    return out;
  }
  const namesByPkg = new Map();
  for (const [pkg, entry] of Object.entries(manifest.packages)) {
    namesByPkg.set(pkg, collectNames(entry, new Set()));
  }

  const ignored = (name) => name.startsWith("_");
  function hasIgnoreMarker(file) {
    try {
      return readFileSync(file, "utf8").slice(0, 400).includes("@registry-ignore");
    } catch {
      return false;
    }
  }
  function exportedIdents(file) {
    let src = "";
    try {
      src = readFileSync(file, "utf8");
    } catch {
      return [];
    }
    const names = new Set();
    for (const m of src.matchAll(
      /export\s+(?:async\s+)?(?:function|const|let|var|class)\s+([A-Za-z0-9_]+)/g,
    ))
      names.add(m[1]);
    for (const m of src.matchAll(/export\s*\{([^}]*)\}/g))
      for (const part of m[1].split(","))
        names.add(
          part
            .trim()
            .split(/\s+as\s+/)
            .pop()
            .trim(),
        );
    return [...names].filter(Boolean);
  }

  // Index of every story file basename across the repo (for the apps/docs case).
  const storyIndex = new Set();
  (function indexStories(dir) {
    let ents = [];
    try {
      ents = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of ents) {
      if (e.name === "node_modules" || e.name === ".turbo" || e.name === "dist") continue;
      const p = join(dir, e.name);
      if (e.isDirectory()) indexStories(p);
      else if (e.name.endsWith(".stories.tsx"))
        storyIndex.add(e.name.replace(/\.stories\.tsx$/, "").toLowerCase());
    }
  })(join(root, "packages"));
  {
    const appsDocs = join(root, "apps", "docs");
    if (existsSync(appsDocs)) {
      (function walk(dir) {
        let ents = [];
        try {
          ents = readdirSync(dir, { withFileTypes: true });
        } catch {
          return;
        }
        for (const e of ents) {
          if (e.name === "node_modules") continue;
          const p = join(dir, e.name);
          if (e.isDirectory()) walk(p);
          else if (e.name.endsWith(".stories.tsx"))
            storyIndex.add(e.name.replace(/\.stories\.tsx$/, "").toLowerCase());
        }
      })(appsDocs);
    }
  }

  const hasStory = (dir, base) =>
    readdirSync(dir).some((f) => f.endsWith(".stories.tsx")) ||
    // a story may live in apps/docs referencing this component
    storyIndex.has(base.toLowerCase());

  // A component folder can ALSO be registered by being the target of its own
  // dedicated `package.json` subpath export (ADR 0006) instead of the main
  // barrel — e.g. `./form` -> `src/components/form/index.ts`, split off the
  // main `.` barrel specifically so importing it does not drag its peer
  // dependency (react-hook-form) into every consumer, issue #26. That is still
  // "registered": `pnpm manifest`'s `readSubpathBarrels()` crawls every
  // non-`.` export and files its members under `packages[pkg].subpaths`, so it
  // reaches the manifest/MCP agent path this gate exists to protect — it is
  // just reached via a different, equally discoverable entry point.
  function subpathComponentDirs(pkgDir, componentsDir) {
    const out = new Set();
    const pkgJsonPath = join(pkgDir, "package.json");
    if (!existsSync(pkgJsonPath)) return out;
    let pkgJson;
    try {
      pkgJson = JSON.parse(readFileSync(pkgJsonPath, "utf8"));
    } catch {
      return out;
    }
    const exportsMap = pkgJson.exports;
    if (!exportsMap || typeof exportsMap !== "object") return out;
    for (const [subpath, target] of Object.entries(exportsMap)) {
      if (subpath === ".") continue; // the main barrel — not a subpath
      const rel = typeof target === "string" ? target : (target?.types ?? target?.default);
      if (typeof rel !== "string") continue;
      const abs = join(pkgDir, rel);
      if (abs.startsWith(componentsDir + "/") || abs === componentsDir) {
        const under = abs.slice(componentsDir.length + 1);
        const name = under.split("/")[0];
        if (name) out.add(name);
      }
    }
    return out;
  }

  // ---- @elabs-ai/components-ui : folder-per-component ----
  const missingStory = [];
  const uiPkgDir = join(root, "packages", "ui");
  const uiComponents = join(uiPkgDir, "src", "components");
  if (existsSync(uiComponents)) {
    const barrel = readFileSync(join(uiPkgDir, "src", "index.ts"), "utf8");
    const subpathRegistered = subpathComponentDirs(uiPkgDir, uiComponents);
    for (const name of readdirSync(uiComponents)) {
      const dir = join(uiComponents, name);
      if (!statSync(dir).isDirectory() || ignored(name)) continue;
      const spec = `./components/${name}`;
      const exported =
        new RegExp(`["']${spec.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(/index)?["']`).test(
          barrel,
        ) || subpathRegistered.has(name);
      if (!exported) {
        blocking.push(
          `@elabs-ai/components-ui: components/${name}/ is NOT re-exported from src/index.ts.\n` +
            `    Add:  export * from "${spec}";   (or run /new-component which wires it)`,
        );
      } else if (!hasStory(dir, name)) {
        missingStory.push(name);
      }
    }
  }

  // ---- STORY RATCHET (blocking for anything not already frozen) ----
  const baselinePath = join(root, STORY_BASELINE);
  const baseline = existsSync(baselinePath)
    ? (JSON.parse(readFileSync(baselinePath, "utf8")).components ?? [])
    : [];
  const { regressions, stale } = findStoryRegressions({ missing: missingStory, baseline });

  if (update) {
    const next = { components: [...missingStory].sort() };
    writeFileSync(baselinePath, JSON.stringify(next, null, 2) + "\n");
    console.log(
      `✔ ${STORY_BASELINE} updated — ${next.components.length} component(s) still missing a story.`,
    );
    return;
  }

  for (const name of regressions) {
    blocking.push(
      `@elabs-ai/components-ui: components/${name}/ has no *.stories.tsx — it is invisible to the\n` +
        "    Storybook-MCP agent path and to the cross-theme/a11y run. Add <name>.stories.tsx\n" +
        '    (tags: ["autodocs"]) beside the component, or scaffold via /new-component.',
    );
  }
  if (stale.length) {
    advisory.push(
      `${STORY_BASELINE} lists ${stale.join(", ")}, which now ship stories — ` +
        "ratchet the baseline down with `pnpm components:check -- --update`.",
    );
  }

  // ---- flat-file packages : ADVISORY orphan check ----
  for (const [pkg, entry] of Object.entries(manifest.packages)) {
    if (pkg === "@elabs-ai/components-ui") continue;
    const srcDir = join(root, entry.path, "src");
    if (!existsSync(srcDir)) continue;
    const known = namesByPkg.get(pkg) ?? new Set();
    for (const f of readdirSync(srcDir)) {
      if (!f.endsWith(".tsx") || f.endsWith(".stories.tsx") || f.endsWith(".test.tsx")) continue;
      if (f === "index.tsx" || ignored(f)) continue;
      const file = join(srcDir, f);
      if (hasIgnoreMarker(file)) continue;
      const idents = exportedIdents(file);
      const hasComponent = idents.some((n) => /^[A-Z]/.test(n));
      if (!hasComponent) continue; // helper/type-only file — not a component module
      if (!idents.some((n) => known.has(n))) {
        advisory.push(
          `${pkg}: ${f} exports [${idents.slice(0, 4).join(", ")}] — none reach the manifest (possible orphan).`,
        );
      }
    }
  }

  if (advisory.length) {
    console.log(`\n⚠ component-registration (advisory — ${advisory.length}):`);
    for (const a of advisory) console.log("  - " + a);
  }
  if (blocking.length) {
    console.error(`\n✖ component-registration gate FAILED (${blocking.length}):`);
    for (const b of blocking) console.error("  - " + b);
    console.error(
      "\nFix the barrel export / add the missing story (or scaffold via /new-component),\n" +
        "then run `pnpm manifest`. Pre-existing story gaps live in " +
        `${STORY_BASELINE} and only ratchet DOWN.`,
    );
    process.exit(1);
  }
  console.log(
    `\n✔ component-registration: every @elabs-ai/components-ui component is barrel-exported and ` +
      `story-covered (${baseline.length} grandfathered, ${advisory.length} advisory).`,
  );
}

// ── CLI ─────────────────────────────────────────────────────────────────────
// Skipped when imported by the self-test (which drives the pure helper directly).
const invokedDirectly =
  process.argv[1] && process.argv[1].endsWith("check-components-registered.mjs");
if (invokedDirectly) runGate({ update: process.argv.includes("--update") });
