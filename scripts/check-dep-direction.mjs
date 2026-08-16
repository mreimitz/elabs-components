#!/usr/bin/env node
/**
 * check-dep-direction.mjs — one-way package dependency DAG gate (#184).
 *
 * The architecture's central invariant — `tokens → ui/icons →
 * data/ai/flow/charts/marketing/editor/blueprint` (CLAUDE.md "Architecture
 * rules", .claude/rules/design-system.md "One direction of dependency") — was
 * stated in prose only; `typecheck`/`lint`/`build` all pass for a sideways or
 * upward `@qlik-coe-emea/qlabs-components-*` import. This gate makes the DAG a deterministic check.
 *
 * `package.json` alone is sufficient: a package can only consume a sibling's
 * runtime surface if it declares the dependency (pnpm workspace resolution),
 * so no AST/source scan is needed. This also means legitimate story/test
 * composition (which lives in `devDependencies` — e.g. `@qlik-coe-emea/qlabs-components-ai`/`@qlik-coe-emea/qlabs-components-data`
 * dev-depending on `@qlik-coe-emea/qlabs-components-charts` for Storybook compositions) is never
 * false-flagged: only `dependencies` + `peerDependencies` (the RUNTIME
 * surfaces) are checked.
 *
 * Layer model (the allowed-edges DAG):
 *   Layer 0 (foundation, no @brand deps):  @qlik-coe-emea/qlabs-components-tokens, @qlik-coe-emea/qlabs-components-icons
 *   Layer 1 (foundation UI):               @qlik-coe-emea/qlabs-components-ui (may depend on: tokens, icons)
 *   Layer 2 (domain, mutually exclusive):  @qlik-coe-emea/qlabs-components-data, @qlik-coe-emea/qlabs-components-ai, @qlik-coe-emea/qlabs-components-flow,
 *                                           @qlik-coe-emea/qlabs-components-maps, @qlik-coe-emea/qlabs-components-charts, @qlik-coe-emea/qlabs-components-marketing,
 *                                           @qlik-coe-emea/qlabs-components-editor, @qlik-coe-emea/qlabs-components-blueprint
 *                                           (may depend on: ui, tokens, icons)
 *
 * `@qlik-coe-emea/qlabs-components-charts` must NOT depend on `@qlik-coe-emea/qlabs-components-data` (.claude/rules/chart-components.md
 * "charts → ui ONLY"; ADR 0012). No domain package may depend on a domain sibling.
 *
 * Tooling packages (`@qlik-coe-emea/qlabs-components-eslint-config`, `@qlik-coe-emea/qlabs-components-typescript-config`) are config,
 * not layer participants, and are ignored entirely (not required to appear in
 * ALLOWED, never flagged as a source or a target).
 *
 * Any `@qlik-coe-emea/qlabs-components-*` package name absent from ALLOWED is itself a violation — forces
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
 * in the visual/component DAG. Never flagged either way. `@qlik-coe-emea/qlabs-components-cli` is the
 * deterministic manifest/docs/search backend (packages/cli) — it has no
 * `@qlik-coe-emea/qlabs-components-*` runtime deps and sits outside the tokens→ui→domain layering.
 */
export const TOOLING_PACKAGES = new Set([
  "@qlik-coe-emea/qlabs-components-eslint-config",
  "@qlik-coe-emea/qlabs-components-typescript-config",
  "@qlik-coe-emea/qlabs-components-cli",
]);

/** ALLOWED @qlik-coe-emea/qlabs-components-* runtime targets per package — the source of truth for the DAG. */
export const ALLOWED = {
  "@qlik-coe-emea/qlabs-components-tokens": [], // foundation
  "@qlik-coe-emea/qlabs-components-icons": [], // foundation
  "@qlik-coe-emea/qlabs-components-ui": [
    "@qlik-coe-emea/qlabs-components-tokens",
    "@qlik-coe-emea/qlabs-components-icons",
  ],
  "@qlik-coe-emea/qlabs-components-data": [
    "@qlik-coe-emea/qlabs-components-tokens",
    "@qlik-coe-emea/qlabs-components-icons",
    "@qlik-coe-emea/qlabs-components-ui",
  ],
  "@qlik-coe-emea/qlabs-components-ai": [
    "@qlik-coe-emea/qlabs-components-tokens",
    "@qlik-coe-emea/qlabs-components-icons",
    "@qlik-coe-emea/qlabs-components-ui",
  ],
  "@qlik-coe-emea/qlabs-components-flow": [
    "@qlik-coe-emea/qlabs-components-tokens",
    "@qlik-coe-emea/qlabs-components-icons",
    "@qlik-coe-emea/qlabs-components-ui",
  ],
  "@qlik-coe-emea/qlabs-components-maps": [
    "@qlik-coe-emea/qlabs-components-tokens",
    "@qlik-coe-emea/qlabs-components-icons",
    "@qlik-coe-emea/qlabs-components-ui",
  ],
  "@qlik-coe-emea/qlabs-components-charts": [
    "@qlik-coe-emea/qlabs-components-tokens",
    "@qlik-coe-emea/qlabs-components-icons",
    "@qlik-coe-emea/qlabs-components-ui",
  ], // NOT @qlik-coe-emea/qlabs-components-data (ADR 0012 / chart rule)
  "@qlik-coe-emea/qlabs-components-marketing": [
    "@qlik-coe-emea/qlabs-components-tokens",
    "@qlik-coe-emea/qlabs-components-icons",
    "@qlik-coe-emea/qlabs-components-ui",
  ],
  "@qlik-coe-emea/qlabs-components-editor": [
    "@qlik-coe-emea/qlabs-components-tokens",
    "@qlik-coe-emea/qlabs-components-icons",
    "@qlik-coe-emea/qlabs-components-ui",
  ],
  "@qlik-coe-emea/qlabs-components-blueprint": [
    "@qlik-coe-emea/qlabs-components-tokens",
    "@qlik-coe-emea/qlabs-components-icons",
    "@qlik-coe-emea/qlabs-components-ui",
  ],
  "@qlik-coe-emea/qlabs-components-viewer": [
    "@qlik-coe-emea/qlabs-components-tokens",
    "@qlik-coe-emea/qlabs-components-icons",
    "@qlik-coe-emea/qlabs-components-ui",
  ], // NOT -ai (ADR 0024 §6: AssetPreview reaches new formats by injection, not import)
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
    if (!name || !name.startsWith("@qlik-coe-emea/qlabs-components-")) continue;
    if (TOOLING_PACKAGES.has(name)) continue;

    const runtimeDeps = {
      ...(manifest.dependencies ?? {}),
      ...(manifest.peerDependencies ?? {}),
    };
    const brandDeps = Object.keys(runtimeDeps).filter((d) =>
      d.startsWith("@qlik-coe-emea/qlabs-components-"),
    );

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
        "data/ai/flow/charts/marketing/editor/blueprint) is documented in CLAUDE.md " +
        '"Architecture rules" and .claude/rules/design-system.md. A sideways or ' +
        "upward @qlik-coe-emea/qlabs-components-* edge in `dependencies`/`peerDependencies` violates it. If a " +
        "shared piece is genuinely needed across domain packages, lift it into " +
        "@qlik-coe-emea/qlabs-components-ui or a registry block — do not relax this gate. See GitHub issue #184.",
    );
    if (!warnOnly) process.exit(1);
    return;
  }

  if (!warnOnly) {
    console.log(
      `✔ dep-direction: no @qlik-coe-emea/qlabs-components-* layer violations (${manifests.length} package(s)).`,
    );
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main(process.argv);
}
