import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { defineConfig } from "tsup";

const here = (relative: string): string =>
  fileURLToPath(new URL(relative, import.meta.url as string));

/**
 * The worker URL literal, in source and in the built output.
 *
 * `createProcessWorker` constructs its worker with
 * `new Worker(new URL("./process-worker.ts", import.meta.url), { type: "module" })` —
 * the shape Vite and webpack recognize and rewrite when they compile OUR SOURCE. They do
 * not rewrite it inside a `dist` they merely consume, so every built bundle that reaches
 * `createProcessWorker` has to carry a specifier that resolves on its own, RELATIVE TO
 * THAT BUNDLE'S OWN LOCATION in `dist/` — which differs by bundle: `dist/core/index.js`
 * sits next to the worker (`./process-worker.js`), `dist/index.js` sits one directory
 * above it (`./core/process-worker.js`).
 *
 * The third build pass below emits the real worker file; `rewriteWorkerSpecifier` renames
 * the source-shaped specifier in a built bundle to match wherever that bundle actually
 * ends up. The two targets are NOT the same length: `"./process-worker.js"` (core, 21
 * bytes) is exactly as long as the 21-byte source literal, so `dist/core/index.js`'s
 * sourcemap stays aligned; `"./core/process-worker.js"` (root, 26 bytes) is 5 bytes
 * longer, so every sourcemap mapping after that literal on its line in `dist/index.js`
 * shifts 5 columns early. That drift is accepted, not unnoticed: `dist/index.js` is
 * unminified, so the shift is confined to the remainder of one line, and regenerating
 * the map for a five-column drift on one line is disproportionate to the cost.
 *
 * Why this rewrite exists at all, and why it needs re-running per bundle: `pnpm build`
 * (tsup/esbuild) cannot catch a wrong specifier here, because this is a byte-level string
 * replace with no validation that its target exists in `dist/` — only a real consumer's
 * bundler build against the packed tarball (`pnpm consumer:check`) resolves the module
 * graph and fails when a specifier points at nothing. That gap is exactly what let the
 * root bundle ship an un-rewritten `dist/process-worker.ts` for a time: `useProcessExplorer`
 * started importing `createProcessWorker` from the root barrel, esbuild dutifully bundled
 * the literal into `dist/index.js` too, and nothing but `consumer:check` noticed the fix
 * below had only ever run against `dist/core/index.js`.
 */
const WORKER_SPECIFIER_SOURCE = '"./process-worker.ts"';

async function rewriteWorkerSpecifier(
  bundleRelativePath: string,
  relativeSpecifier: string,
  { requireOccurrence }: { requireOccurrence: boolean },
): Promise<void> {
  const bundle = here(bundleRelativePath);
  const text = await readFile(bundle, "utf8");
  const occurrences = text.split(WORKER_SPECIFIER_SOURCE).length - 1;
  // A bundle that does not need to reach createProcessWorker (requireOccurrence: false)
  // legitimately has 0 occurrences — e.g. a future root barrel that stops re-exporting
  // useProcessExplorer. Silently skip it rather than failing the build over an absence
  // that is not a regression. `> 1` still throws unconditionally: a duplicated literal
  // means the "no target validation" assumption behind this whole mechanism has broken,
  // whether or not this bundle is the one required to carry the worker.
  if (occurrences === 0 && !requireOccurrence) {
    return;
  }
  if (occurrences !== 1) {
    throw new Error(
      `${bundleRelativePath}: expected exactly 1 ${WORKER_SPECIFIER_SOURCE} worker specifier, found ${occurrences}. ` +
        "createProcessWorker's `new URL(…, import.meta.url)` must stay a single literal so the built " +
        `bundle can be pointed at ${relativeSpecifier}.`,
    );
  }
  await writeFile(bundle, text.replace(WORKER_SPECIFIER_SOURCE, `"${relativeSpecifier}"`), "utf8");
}

/**
 * Point the built core bundle at the built worker.
 *
 * `requireOccurrence: true` — `/core` is the entry that owns `createProcessWorker`; a
 * zero here means the worker code stopped being reachable from the framework-free leaf,
 * which is a real structural change and should fail the build loudly, exactly as before
 * this helper was generalized.
 */
async function pointCoreBundleAtBuiltWorker(): Promise<void> {
  await rewriteWorkerSpecifier("dist/core/index.js", "./process-worker.js", {
    requireOccurrence: true,
  });
}

/**
 * Point the built ROOT bundle at the built worker, when it reaches one.
 *
 * `requireOccurrence: false` — the root barrel only bundles `createProcessWorker`
 * transitively, via whichever exports happen to import it (today: `useProcessExplorer`).
 * A future barrel that no longer reaches the worker is not a build error, so 0
 * occurrences is tolerated silently; `> 1` still throws (see `rewriteWorkerSpecifier`).
 */
async function pointRootBundleAtBuiltWorker(): Promise<void> {
  await rewriteWorkerSpecifier("dist/index.js", "./core/process-worker.js", {
    requireOccurrence: false,
  });
}

// Three passes, because `./core` is the FRAMEWORK-FREE leaf (ADR 0034 / ADR 0006):
// event-log types, directly-follows derivation, variant/conformance math — no React,
// no React Flow, no visx. Bundling it in the same pass as the main barrel would let
// esbuild emit a shared chunk that drags the rendering engines into the core entry,
// which is exactly the dependency edge the subpath exists to prevent. The charts and
// editor packages carry the same warning: entries use the OBJECT form so output paths
// are explicit (tsup derives the out-dir from the common base of a pass's entries, so
// an array would emit dist/index.js for both and silently break
// publishConfig.exports["./core"]).
export default defineConfig([
  {
    entry: { index: "src/index.ts" },
    format: ["esm"],
    dts: true,
    sourcemap: true,
    // NOTE: no pass cleans. tsup runs the four configs concurrently, so a
    // `clean: true` here races the other passes' output and non-deterministically
    // wipes their .d.ts — tsup's declaration build has its own unscoped clean that
    // the outer clean (which deliberately excludes *.d.ts) does not share, so
    // whichever pass rolls its declarations up LAST deletes every one written
    // before it. The build script does `rm -rf dist` up front instead. Passing an
    // array to `clean` does not help: the dts-side clean only tests it for truthiness.
    clean: false,
    // esbuild strips per-module "use client" directives when it bundles, so the
    // directives in src/ never reach dist/. Re-assert it for the whole bundle.
    banner: { js: '"use client";' },
    // Dependencies & peerDependencies are externalized by tsup automatically.
    external: ["react", "react-dom"],
    onSuccess: pointRootBundleAtBuiltWorker,
  },
  {
    // The framework-free core leaf — no React, so NO "use client" banner: a consumer
    // must be able to import it from a server module.
    entry: { "core/index": "src/core/index.ts" },
    format: ["esm"],
    dts: true,
    sourcemap: true,
    clean: false, // see the NOTE on the first pass — no pass cleans.
    external: ["react", "react-dom"],
    onSuccess: pointCoreBundleAtBuiltWorker,
  },
  {
    // The worker script, as a real file the built bundle's `new URL(…)` can resolve.
    // Its own pass, with splitting OFF, so it is self-contained: a worker that had to
    // fetch a shared chunk would turn one URL that must resolve into two. It costs a
    // duplicated copy of the derivation code in a file that is only ever fetched inside
    // a worker, which is the cheaper side of that trade.
    //
    // Deliberately NOT a `publishConfig.exports` subpath — nothing imports it by name;
    // it is fetched by URL, so it needs to EXIST in dist, not to be addressable.
    entry: { "core/process-worker": "src/core/worker/process-worker.ts" },
    format: ["esm"],
    dts: false,
    splitting: false,
    sourcemap: true,
    clean: false,
    external: ["react", "react-dom"],
  },
  {
    // The `./test` jsdom-safe double subpath (RM-053, mirrors `@elabs-ai/components-charts`'s
    // identical third pass) — React-based (the doubles are `forwardRef` components), so it
    // DOES carry the "use client" banner, unlike the core pass above.
    entry: { "test/index": "src/test/index.ts" },
    format: ["esm"],
    dts: true,
    sourcemap: true,
    clean: false,
    banner: { js: '"use client";' },
    external: ["react", "react-dom"],
  },
]);
