/**
 * dep-direction — the one-way `@elabs-ai/components-*` package DAG (#184, ADR 0034).
 * Ported from scripts/check-dep-direction.mjs.
 *
 * `tokens → ui/icons → data/ai/flow/maps/charts/marketing/editor/viewer/terminal → process`
 * is the architecture's central invariant; typecheck/lint/build all pass for a sideways or
 * upward edge. `package.json` alone is sufficient: a package can only consume a sibling's
 * runtime surface if it declares it, so only `dependencies` + `peerDependencies` are checked.
 * `devDependencies` (story/test composition) never are.
 *
 * `ALLOWED` below is THE machine-readable copy of the DAG that CLAUDE.md, design-system.md and
 * the ADRs cite. A `@elabs-ai/components-*` package absent from it is itself a violation, so
 * adding a package forces a layer decision.
 */

/** Config/build tooling — not layer participants; never flagged as source or target. */
export const TOOLING_PACKAGES = new Set([
  "@elabs-ai/components-eslint-config",
  "@elabs-ai/components-typescript-config",
  "@elabs-ai/components-cli",
]);

const T = "@elabs-ai/components-tokens";
const I = "@elabs-ai/components-icons";
const U = "@elabs-ai/components-ui";
const LAYER_2 = [T, I, U];

/** ALLOWED @elabs-ai/components-* runtime targets per package — the source of truth for the DAG. */
export const ALLOWED = {
  [T]: [], // layer 0 — foundation
  [I]: [], // layer 0 — foundation
  [U]: [T, I], // layer 1
  "@elabs-ai/components-data": LAYER_2,
  "@elabs-ai/components-ai": LAYER_2,
  "@elabs-ai/components-flow": LAYER_2,
  "@elabs-ai/components-maps": LAYER_2,
  "@elabs-ai/components-charts": LAYER_2, // NOT -data (ADR 0012 / chart rule)
  // `charts/dashboard` (ADR 0037) is a subpath of -charts, not a package: same row, no new arrow.
  "@elabs-ai/components-marketing": LAYER_2,
  "@elabs-ai/components-editor": LAYER_2,
  "@elabs-ai/components-viewer": LAYER_2, // NOT -ai (ADR 0024 §6: injection, not import)
  "@elabs-ai/components-terminal": LAYER_2, // leaf: nothing depends on it; never lists -ai
  // LAYER 3 (ADR 0034) — the only package allowed to depend on layer-2 leaves, and the
  // terminal node of the DAG: no entry above may ever list it.
  "@elabs-ai/components-process": [
    T,
    I,
    U,
    "@elabs-ai/components-flow",
    "@elabs-ai/components-charts",
    "@elabs-ai/components-data",
  ],
};

const BRAND = "@elabs-ai/components-";

/** Pure: `[{ from, to, reason }]` over a set of manifests (`to: null` = unregistered package). */
export function findDepDirectionViolations(manifests) {
  const violations = [];
  for (const manifest of manifests) {
    const name = manifest?.name;
    if (!name || !name.startsWith(BRAND) || TOOLING_PACKAGES.has(name)) continue;
    if (!(name in ALLOWED)) {
      violations.push({
        from: name,
        to: null,
        reason: `"${name}" is not registered in ALLOWED — add a layer entry in scripts/check/rules/dep-direction.mjs`,
      });
      continue;
    }
    const runtime = { ...(manifest.dependencies ?? {}), ...(manifest.peerDependencies ?? {}) };
    const allowed = ALLOWED[name];
    for (const dep of Object.keys(runtime)) {
      if (!dep.startsWith(BRAND) || TOOLING_PACKAGES.has(dep) || allowed.includes(dep)) continue;
      violations.push({
        from: name,
        to: dep,
        reason: `not allowed; "${name}" may only depend on: ${allowed.length ? allowed.join(", ") : "(nothing — foundation layer)"}`,
      });
    }
  }
  return violations;
}

function lineOfKey(text, key) {
  const i = text.indexOf(`"${key}"`);
  return i < 0 ? 1 : text.slice(0, i).split("\n").length;
}

const pkg = (dir, json) => ({ [`packages/${dir}/package.json`]: JSON.stringify(json, null, 2) });
const ws = (...names) => Object.fromEntries(names.map((n) => [n, "workspace:*"]));

export default {
  id: "dep-direction",
  scope: "packages",
  doc: "`@elabs-ai/components-*` runtime deps (`dependencies`/`peerDependencies`) follow the one-way DAG `tokens → ui/icons → layer-2 leaves → process`; every package is registered in `ALLOWED`, and a shared piece moves down, never sideways.",
  baseline: "none",
  run(ctx) {
    const findings = [];
    for (const file of ctx.glob("packages/*/package.json")) {
      const text = ctx.readFile(file);
      let manifest;
      try {
        manifest = JSON.parse(text);
      } catch (err) {
        findings.push({ file, line: 1, msg: `cannot parse: ${err.message}` });
        continue;
      }
      for (const v of findDepDirectionViolations([manifest])) {
        findings.push({
          file,
          line: v.to ? lineOfKey(text, v.to) : 1,
          msg: v.to ? `${v.from} → ${v.to} (${v.reason})` : `${v.from}: ${v.reason}`,
        });
      }
    }
    return findings;
  },
  fixtures: {
    pass: [
      // the real current edges
      {
        files: {
          ...pkg("tokens", { name: T }),
          ...pkg("icons", { name: I }),
          ...pkg("ui", { name: U, peerDependencies: ws(T) }),
          ...pkg("data", { name: "@elabs-ai/components-data", peerDependencies: ws(T, I, U) }),
          ...pkg("charts", { name: "@elabs-ai/components-charts", peerDependencies: ws(T, U) }),
          ...pkg("process", {
            name: "@elabs-ai/components-process",
            dependencies: ws("@elabs-ai/components-flow", "@elabs-ai/components-data"),
          }),
        },
      },
      // devDependencies-only sibling edge (story/test composition)
      {
        files: pkg("ai", {
          name: "@elabs-ai/components-ai",
          peerDependencies: ws(T, U),
          devDependencies: ws("@elabs-ai/components-charts"),
        }),
      },
      // tooling packages never flagged either way
      {
        files: {
          ...pkg("eslint-config", {
            name: "@elabs-ai/components-eslint-config",
            dependencies: ws(U),
          }),
          ...pkg("ui", { name: U, dependencies: ws("@elabs-ai/components-eslint-config") }),
        },
      },
      // third-party deps
      {
        files: pkg("flow", {
          name: "@elabs-ai/components-flow",
          peerDependencies: ws(T, U),
          dependencies: { "@xyflow/react": "^12.0.0", ai: "^4.0.0" },
        }),
      },
      // non-brand manifests are ignored
      { files: pkg("some-app", { name: "some-app", dependencies: ws(U) }) },
    ],
    fail: [
      {
        files: pkg("data", {
          name: "@elabs-ai/components-data",
          dependencies: ws("@elabs-ai/components-charts"),
        }),
      },
      { files: pkg("ui", { name: U, dependencies: ws("@elabs-ai/components-data") }) },
      {
        files: pkg("charts", {
          name: "@elabs-ai/components-charts",
          peerDependencies: ws("@elabs-ai/components-data"),
        }),
      },
      { files: pkg("tokens", { name: T, dependencies: ws(U) }) },
      { files: pkg("newthing", { name: "@elabs-ai/components-newthing", dependencies: {} }) },
      {
        files: pkg("ai", {
          name: "@elabs-ai/components-ai",
          dependencies: ws("@elabs-ai/components-terminal"),
        }),
      },
      { files: pkg("ui", { name: U, dependencies: ws("@elabs-ai/components-process") }) },
    ],
  },
};
