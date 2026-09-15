/**
 * trusted-types-patches — the Radix packages we patched stay patched.
 * Ported from scripts/check-csp-sinks.mjs rung 2 (+ its self-test's registration check).
 *
 * `@radix-ui/react-scroll-area` and `@radix-ui/react-select` each shipped an
 * unconditional `<style dangerouslySetInnerHTML>` with nothing but static scrollbar
 * rules; `patches/` removes it and `packages/tokens/src/radix-viewport.css` ships the
 * rules instead. A version bump that silently drops a patch re-breaks every consumer
 * under a strict CSP (a blank window) with a fully green unit suite. Never baselined.
 * Reads `node_modules`, so it needs `pnpm install`.
 */
import { depIsDirty, resolvePkgDir } from "./trusted-types-sinks.mjs";

export const PATCHED_PACKAGES = ["@radix-ui/react-scroll-area", "@radix-ui/react-select"];

const ROOT_PKG = "package.json";

// ── fixtures ─────────────────────────────────────────────────────────────────
const PATCHED = Object.fromEntries(PATCHED_PACKAGES.map((n) => [`${n}@1.0.0`, `patches/x.patch`]));
function tree({ registered = PATCHED, dirty = null, installed = true } = {}) {
  const files = {
    [ROOT_PKG]: JSON.stringify({ pnpm: { patchedDependencies: registered } }),
    "packages/ui/package.json": JSON.stringify({
      name: "@elabs-ai/components-ui",
      dependencies: Object.fromEntries(PATCHED_PACKAGES.map((n) => [n, "1.0.0"])),
    }),
  };
  if (installed)
    for (const n of PATCHED_PACKAGES) {
      files[`packages/ui/node_modules/${n}/package.json`] = "{}";
      files[`packages/ui/node_modules/${n}/dist/index.mjs`] =
        n === dirty ? "<style dangerouslySetInnerHTML={{__html: css}} />" : "export {};";
    }
  return { files };
}

export default {
  id: "trusted-types-patches",
  scope: "packages",
  doc: "Keep `@radix-ui/react-scroll-area` and `@radix-ui/react-select` patched (registered in `pnpm.patchedDependencies`, installed dist free of HTML sinks); after a version bump re-apply the patch with `pnpm patch`.",
  baseline: "none",
  run(ctx) {
    const out = [];
    const rootJson = ctx.json(ROOT_PKG);
    const registered = Object.keys(rootJson.pnpm?.patchedDependencies ?? {});
    for (const name of PATCHED_PACKAGES) {
      if (!registered.some((p) => p.startsWith(`${name}@`)))
        out.push({
          file: ROOT_PKG,
          line: 1,
          msg: `${name} is missing from pnpm.patchedDependencies — its patch never applies`,
        });
      let resolved = 0;
      for (const p of ctx.packages()) {
        if (!(name in (p.json.dependencies ?? {}))) continue;
        const dir = resolvePkgDir(ctx, name, p.dir);
        if (!dir) continue;
        resolved++;
        if (depIsDirty(ctx, dir))
          out.push({
            file: `${p.dir}/package.json`,
            line: 1,
            msg: `PATCHED package ${name} carries its Trusted-Types sink again — a version bump dropped the patch in patches/; re-apply it (pnpm patch ${name}@<version>)`,
          });
      }
      // Fail closed: "not installed" is not "still clean".
      if (resolved === 0)
        out.push({
          file: ROOT_PKG,
          line: 1,
          msg: `${name} is not installed for any workspace package that depends on it — cannot prove its patch holds (run pnpm install)`,
        });
    }
    return out;
  },
  fixtures: {
    pass: [tree()],
    fail: [
      tree({ installed: false }),
      tree({ dirty: "@radix-ui/react-select" }),
      tree({ registered: { "@radix-ui/react-select@1.0.0": "p" } }),
    ],
  },
};
