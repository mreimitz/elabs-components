import { test } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";
import { resolveProps, resolveAllProps, mergeResolvedProps, sanitizeType } from "../lib/docgen.mjs";
import { findRepoRoot, generateManifest, flat } from "../lib/core.mjs";

// #79 / ADR 0013 — the resolved-prop-table half. These tests cover the parts
// that DON'T require `react-docgen-typescript` to be installed: the fail-safe
// no-dep fallback (the floor) and the additive merge. The resolved (engine-on)
// path is UNVALIDATED here until a human runs `pnpm install` — by design, the
// dep is intentionally absent so we can prove the no-op floor.

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = findRepoRoot(here);

test("resolveProps returns null when react-docgen-typescript is absent (the floor)", async () => {
  // The dep is NOT installed in this block, so the guarded dynamic import must
  // swallow the failure and return null — never throw.
  const out = await resolveProps(repoRoot, "/nonexistent/pkg", [
    { name: "Button", module: "packages/ui/src/button/button.tsx" },
  ]);
  assert.equal(out, null, "no engine → null (no-op), not a throw");
});

test("resolveProps is a clean no-op for empty / malformed input", async () => {
  assert.equal(await resolveProps(repoRoot, "/x", []), null);
  assert.equal(await resolveProps(null, null, null), null);
  assert.equal(await resolveProps(repoRoot, "/x", "not-an-array"), null);
});

test("resolveAllProps returns null when the engine is absent (whole-run floor)", async (t) => {
  if (!repoRoot) return t.skip("not inside the monorepo");
  const out = await resolveAllProps(repoRoot);
  // With the devDep uninstalled this MUST be null so generateManifest produces
  // the byte-identical dependency-free manifest. (Once installed, it returns a map.)
  assert.equal(out, null, "no engine → null; manifest stays dependency-free");
});

test("generateManifest(root) is byte-identical with and without an absent resolved map", (t) => {
  if (!repoRoot) return t.skip("not inside the monorepo");
  const a = generateManifest(repoRoot);
  const b = generateManifest(repoRoot, { resolved: null });
  const norm = (m) => JSON.stringify({ ...m, generatedAt: 0 });
  assert.equal(norm(a), norm(b), "null resolved map → identical to today's output");
});

test("generateManifest does not throw and is well-formed without the docgen dep", (t) => {
  if (!repoRoot) return t.skip("not inside the monorepo");
  const m = generateManifest(repoRoot);
  assert.ok(m && typeof m === "object", "manifest object produced");
  assert.ok(Object.keys(m.packages).length > 0, "packages present");
  // The dependency-free prop table for a known component is unchanged in shape.
  const button = flat(m).find((r) => r.name === "Button");
  assert.ok(button, "Button present");
  assert.ok(button.props, "Button has a prop table");
  assert.ok(Array.isArray(button.props.props), "props.props is the own-declared array");
  assert.ok(Array.isArray(button.props.extends), "props.extends is the inherited-clause array");
});

// ---- mergeResolvedProps: the additive contract -----------------------------

test("mergeResolvedProps adds defaultValue and fills missing descriptions, never overwrites", () => {
  const table = {
    extends: ["ButtonHTMLAttributes<HTMLButtonElement>"],
    props: [
      { name: "asChild", optional: true, type: "boolean", description: "Authored doc." },
      { name: "label", optional: false, type: "string" },
    ],
  };
  const resolvedMap = {
    asChild: {
      type: "boolean",
      optional: true,
      defaultValue: "false",
      description: "RESOLVED doc.",
    },
    label: { type: "string", optional: false, description: "Resolved label doc." },
  };
  mergeResolvedProps(table, resolvedMap);

  const asChild = table.props.find((p) => p.name === "asChild");
  assert.equal(asChild.defaultValue, "false", "defaultValue filled (regex never has it)");
  assert.equal(asChild.description, "Authored doc.", "existing description NOT overwritten");
  assert.equal(asChild.type, "boolean", "authored type kept");

  const label = table.props.find((p) => p.name === "label");
  assert.equal(
    label.description,
    "Resolved label doc.",
    "missing description filled from resolved",
  );
});

test("mergeResolvedProps records inherited (non-own) props under table.resolved, sorted", () => {
  const table = {
    extends: ["HTMLAttributes<HTMLDivElement>"],
    props: [{ name: "tone", optional: true, type: "string" }],
  };
  const resolvedMap = {
    tone: { type: "string", optional: true }, // own-declared — must NOT leak into resolved
    onClick: { type: "MouseEventHandler", optional: true, description: "Click handler." },
    className: { type: "string", optional: true },
  };
  mergeResolvedProps(table, resolvedMap);

  assert.ok(table.resolved, "resolved inherited map added");
  assert.ok(!("tone" in table.resolved), "own-declared prop not duplicated into resolved");
  assert.ok(
    "onClick" in table.resolved && "className" in table.resolved,
    "inherited props recorded",
  );
  assert.deepEqual(
    Object.keys(table.resolved),
    ["className", "onClick"],
    "deterministic sorted order",
  );
});

test("mergeResolvedProps is a no-op for null/garbage resolved maps", () => {
  const table = { extends: [], props: [{ name: "x", optional: false, type: "number" }] };
  const before = JSON.stringify(table);
  mergeResolvedProps(table, null);
  mergeResolvedProps(table, undefined);
  mergeResolvedProps(table, "nope");
  assert.equal(JSON.stringify(table), before, "garbage input leaves the table untouched");
});

test("generateManifest merges a synthetic resolved map additively (engine-output shape)", (t) => {
  if (!repoRoot) return t.skip("not inside the monorepo");
  // Simulate what resolveAllProps WOULD return (so we exercise the seam without
  // the dep): inject a default + an inherited prop for Button and confirm they
  // land in the manifest without disturbing the own-declared table.
  const baseline = generateManifest(repoRoot);
  const baseButton = flat(baseline).find((r) => r.name === "Button");
  const ownCount = baseButton.props.props.length;

  const resolved = {
    "@elabs-ai/components-ui": {
      Button: {
        asChild: { type: "boolean", optional: true, defaultValue: "false" },
        onClick: {
          type: "MouseEventHandler<HTMLButtonElement>",
          optional: true,
          description: "Click.",
        },
      },
    },
  };
  const enriched = generateManifest(repoRoot, { resolved });
  const button = flat(enriched).find((r) => r.name === "Button");
  assert.equal(button.props.props.length, ownCount, "own-declared prop count unchanged (additive)");
  assert.ok(button.props.resolved?.onClick, "inherited prop recorded under resolved");
  assert.equal(button.props.resolved.onClick.description, "Click.", "resolved description carried");
});

// ---- sanitizeType: DETERMINISM (#79) ---------------------------------------
// react-docgen renders some imported types as `typeof import("<absolute path>")`.
// That absolute prefix is machine-specific and would make the committed manifest
// un-reproducible (false stale-gate failures). sanitizeType must collapse it to a
// stable, machine-independent module specifier. These are pure + fast (no engine).

test("sanitizeType collapses a pnpm node_modules import() path to the bare module specifier", () => {
  const abs =
    '((editor: IStandaloneCodeEditor, monacoApi: typeof import("/Users/me/proj/node_modules/.pnpm/monaco-editor@0.52.0/node_modules/monaco-editor/esm/vs/editor/editor.api")) => void)';
  const out = sanitizeType(abs);
  assert.ok(!out.includes("node_modules"), "the node_modules path prefix is stripped");
  assert.ok(!out.includes("/Users/"), "no absolute machine path remains");
  assert.ok(!out.includes(".pnpm"), "the pnpm version-wrapper segment is stripped");
  assert.ok(
    out.includes('import("monaco-editor/esm/vs/editor/editor.api")'),
    "collapses to the bare module specifier after the LAST node_modules/",
  );
});

test("sanitizeType strips a leaked repo-root absolute path to a repo-relative one", () => {
  const repoRoot = "/Users/me/proj";
  const out = sanitizeType('typeof import("/Users/me/proj/packages/ui/src/types")', repoRoot);
  assert.equal(out, 'typeof import("packages/ui/src/types")');
});

test("sanitizeType is idempotent and a no-op for clean / non-string input", () => {
  const clean = "MouseEventHandler<HTMLButtonElement>";
  assert.equal(sanitizeType(clean), clean, "a type with no import() path is untouched");
  const dirty =
    'typeof import("/x/node_modules/.pnpm/monaco-editor@1/node_modules/monaco-editor/api")';
  const once = sanitizeType(dirty);
  assert.equal(sanitizeType(once), once, "running twice yields the same string (idempotent)");
  assert.equal(sanitizeType(undefined), undefined, "non-string passes through");
  assert.equal(sanitizeType(42), 42, "non-string passes through");
});
