#!/usr/bin/env node
/**
 * check-dep-direction.mjs — one-way package dependency DAG gate (#184).
 *
 * The architecture's central invariant — `tokens → ui/icons →
 * data/ai/flow/charts/marketing/editor` (CLAUDE.md "Architecture
 * rules", .claude/rules/design-system.md "One direction of dependency") — was
 * stated in prose only; `typecheck`/`lint`/`build` all pass for a sideways or
 * upward `@elabs-ai/components-*` import. This gate makes the DAG a deterministic check.
 *
 * `package.json` alone is sufficient: a package can only consume a sibling's
 * runtime surface if it declares the dependency (pnpm workspace resolution),
 * so no AST/source scan is needed. This also means legitimate story/test
 * composition (which lives in `devDependencies` — e.g. `@elabs-ai/components-ai`/`@elabs-ai/components-data`
 * dev-depending on `@elabs-ai/components-charts` for Storybook compositions) is never
 * false-flagged: only `dependencies` + `peerDependencies` (the RUNTIME
 * surfaces) are checked.
 *
 * Layer model (the allowed-edges DAG):
 *   Layer 0 (foundation, no @brand deps):  @elabs-ai/components-tokens, @elabs-ai/components-icons
 *   Layer 1 (foundation UI):               @elabs-ai/components-ui (may depend on: tokens, icons)
 *   Layer 2 (domain, mutually exclusive):  @elabs-ai/components-data, @elabs-ai/components-ai, @elabs-ai/components-flow,
 *                                           @elabs-ai/components-maps, @elabs-ai/components-charts, @elabs-ai/components-marketing,
 *                                           @elabs-ai/components-editor
 *                                           (may depend on: ui, tokens, icons)
 *
 * `@elabs-ai/components-charts` must NOT depend on `@elabs-ai/components-data` (.claude/rules/chart-components.md
 * "charts → ui ONLY"; ADR 0012). No domain package may depend on a domain sibling.
 *
 * Tooling packages (`@elabs-ai/components-eslint-config`, `@elabs-ai/components-typescript-config`) are config,
 * not layer participants, and are ignored entirely (not required to appear in
 * ALLOWED, never flagged as a source or a target).
 *
 * Any `@elabs-ai/components-*` package name absent from ALLOWED is itself a violation — forces
 * the map to be updated when a new package is added (ties into the "Adding a new
 * package" registration discipline, quality-gates.md).
 *
 * Dependency-free; ESM; resolves each package's `package.json` under `packages/`
 * relative to this file (cwd-independent). Exports the pure checker for the
 * self-test.
 *
 * Flags:
 *   --warn   never exit non-zero (dev-hook mode); still prints findings.
 */
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = dirname(SCRIPT_DIR); // scripts/ → repo root
const PACKAGES_DIR = join(REPO_ROOT, "packages");

/**
 * Tooling / infra packages — config or build tooling, not layer participants
 * in the visual/component DAG. Never flagged either way. `@elabs-ai/components-cli` is the
 * deterministic manifest/docs/search backend (packages/cli) — it has no
 * `@elabs-ai/components-*` runtime deps and sits outside the tokens→ui→domain layering.
 */
export const TOOLING_PACKAGES = new Set([
  "@elabs-ai/components-eslint-config",
  "@elabs-ai/components-typescript-config",
  "@elabs-ai/components-cli",
]);

/** ALLOWED @elabs-ai/components-* runtime targets per package — the source of truth for the DAG. */
export const ALLOWED = {
  "@elabs-ai/components-tokens": [], // foundation
  "@elabs-ai/components-icons": [], // foundation
  "@elabs-ai/components-ui": ["@elabs-ai/components-tokens", "@elabs-ai/components-icons"],
  "@elabs-ai/components-data": [
    "@elabs-ai/components-tokens",
    "@elabs-ai/components-icons",
    "@elabs-ai/components-ui",
  ],
  "@elabs-ai/components-ai": [
    "@elabs-ai/components-tokens",
    "@elabs-ai/components-icons",
    "@elabs-ai/components-ui",
  ],
  "@elabs-ai/components-flow": [
    "@elabs-ai/components-tokens",
    "@elabs-ai/components-icons",
    "@elabs-ai/components-ui",
  ],
  "@elabs-ai/components-maps": [
    "@elabs-ai/components-tokens",
    "@elabs-ai/components-icons",
    "@elabs-ai/components-ui",
  ],
  "@elabs-ai/components-charts": [
    "@elabs-ai/components-tokens",
    "@elabs-ai/components-icons",
    "@elabs-ai/components-ui",
  ], // NOT @elabs-ai/components-data (ADR 0012 / chart rule)
  "@elabs-ai/components-marketing": [
    "@elabs-ai/components-tokens",
    "@elabs-ai/components-icons",
    "@elabs-ai/components-ui",
  ],
  "@elabs-ai/components-editor": [
    "@elabs-ai/components-tokens",
    "@elabs-ai/components-icons",
    "@elabs-ai/components-ui",
  ],
  "@elabs-ai/components-viewer": [
    "@elabs-ai/components-tokens",
    "@elabs-ai/components-icons",
    "@elabs-ai/components-ui",
  ], // NOT -ai (ADR 0024 §6: AssetPreview reaches new formats by injection, not import)
  "@elabs-ai/components-terminal": [
    "@elabs-ai/components-tokens",
    "@elabs-ai/components-icons",
    "@elabs-ai/components-ui",
  ], // layer-2 leaf: NOTHING may depend on it, and it must never list -ai (sideways edge)
  // LAYER 3 (ADR 0034) — the only package allowed to depend on layer-2 leaves. It is
  // the terminal node of the DAG: no entry above may ever list it, which is what keeps
  // the graph acyclic while letting one package compose flow + charts + data + ui.
  "@elabs-ai/components-process": [
    "@elabs-ai/components-tokens",
    "@elabs-ai/components-icons",
    "@elabs-ai/components-ui",
    "@elabs-ai/components-flow",
    "@elabs-ai/components-charts",
    "@elabs-ai/components-data",
  ],
};

/**
 * Find dependency-direction violations across a set of manifests.
 *
 * @param {{ name: string, dependencies?: Record<string,string>,
 *            peerDependencies?: Record<string,string> }[]} manifests
 * @returns {{ from: string, to: string, reason: string }[]}
 */
export function findDepDirectionViolations(manifests) {
  const violations = [];
  for (const manifest of manifests) {
    const name = manifest?.name;
    if (!name || !name.startsWith("@elabs-ai/components-")) continue;
    if (TOOLING_PACKAGES.has(name)) continue;

    const runtimeDeps = {
      ...(manifest.dependencies ?? {}),
      ...(manifest.peerDependencies ?? {}),
    };
    const brandDeps = Object.keys(runtimeDeps).filter((d) => d.startsWith("@elabs-ai/components-"));

    if (!(name in ALLOWED)) {
      violations.push({
        from: name,
        to: null,
        reason: `"${name}" is not registered in ALLOWED — add a layer entry in scripts/check-dep-direction.mjs`,
      });
      continue;
    }

    for (const dep of brandDeps) {
      if (TOOLING_PACKAGES.has(dep)) continue;
      const allowedTargets = ALLOWED[name] ?? [];
      if (!allowedTargets.includes(dep)) {
        violations.push({
          from: name,
          to: dep,
          reason: `not allowed; "${name}" may only depend on: ${allowedTargets.length ? allowedTargets.join(", ") : "(nothing — foundation layer)"}`,
        });
      }
    }
  }
  return violations;
}

// ───────────────────────────────── CLI ────────────────────────────────────────
function loadManifests() {
  const manifests = [];
  if (!existsSync(PACKAGES_DIR)) return manifests;
  for (const entry of readdirSync(PACKAGES_DIR, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const pkgJsonPath = join(PACKAGES_DIR, entry.name, "package.json");
    if (!existsSync(pkgJsonPath)) continue;
    try {
      manifests.push(JSON.parse(readFileSync(pkgJsonPath, "utf8")));
    } catch (e) {
      console.error(`✖ dep-direction gate: failed to parse ${pkgJsonPath}: ${e.message}`);
      process.exit(1);
    }
  }
  return manifests;
}

function main(argv) {
  const args = argv.slice(2);
  const warnOnly = args.includes("--warn");

  const manifests = loadManifests();
  const violations = findDepDirectionViolations(manifests);

  if (violations.length) {
    const label = warnOnly ? "⚠ dep-direction" : "✖ dep-direction gate FAILED";
    console.error(`\n${label} (${violations.length}):`);
    for (const v of violations) {
      if (v.to) {
        console.error(`  - ${v.from} → ${v.to} (${v.reason})`);
      } else {
        console.error(`  - ${v.from}: ${v.reason}`);
      }
    }
    console.error(
      "\nThe one-way package dependency DAG (tokens → ui/icons → " +
        "data/ai/flow/charts/marketing/editor) is documented in CLAUDE.md " +
        '"Architecture rules" and .claude/rules/design-system.md. A sideways or ' +
        "upward @elabs-ai/components-* edge in `dependencies`/`peerDependencies` violates it. If a " +
        "shared piece is genuinely needed across domain packages, lift it into " +
        "@elabs-ai/components-ui or a registry block — do not relax this gate. See GitHub issue #184.",
    );
    if (!warnOnly) process.exit(1);
    return;
  }

  if (!warnOnly) {
    console.log(
      `✔ dep-direction: no @elabs-ai/components-* layer violations (${manifests.length} package(s)).`,
    );
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main(process.argv);
}
