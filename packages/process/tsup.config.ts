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
 * not rewrite it inside a `dist` they merely consume, so the built bundle has to carry a
 * specifier that resolves on its own, next to `dist/core/index.js`.
 *
 * The third build pass below emits exactly that file; this pair renames the specifier in
 * the built bundle to match it. Both strings are the same length, so the already-written
 * sourcemap stays aligned.
 */
const WORKER_SPECIFIER_SOURCE = '"./process-worker.ts"';
const WORKER_SPECIFIER_BUILT = '"./process-worker.js"';

/**
 * Point the built core bundle at the built worker.
 *
 * Throws when the literal is missing or appears more than once, so a refactor that moves
 * or duplicates the `new URL(…)` fails the BUILD rather than shipping a bundle whose
 * worker path resolves to nothing — which is the exact regression this exists to prevent
 * (a consumer's `vite build` died on `dist/core/process-worker.ts`).
 */
async function pointCoreBundleAtBuiltWorker(): Promise<void> {
  const bundle = here("dist/core/index.js");
  const text = await readFile(bundle, "utf8");
  const occurrences = text.split(WORKER_SPECIFIER_SOURCE).length - 1;
  if (occurrences !== 1) {
    throw new Error(
      `dist/core/index.js: expected exactly 1 ${WORKER_SPECIFIER_SOURCE} worker specifier, found ${occurrences}. ` +
        "createProcessWorker's `new URL(…, import.meta.url)` must stay a single literal so the built " +
        "bundle can be pointed at dist/core/process-worker.js.",
    );
  }
  await writeFile(bundle, text.replace(WORKER_SPECIFIER_SOURCE, WORKER_SPECIFIER_BUILT), "utf8");
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
    clean: true,
    // esbuild strips per-module "use client" directives when it bundles, so the
    // directives in src/ never reach dist/. Re-assert it for the whole bundle.
    banner: { js: '"use client";' },
    // Dependencies & peerDependencies are externalized by tsup automatically.
    external: ["react", "react-dom"],
  },
  {
    // The framework-free core leaf — no React, so NO "use client" banner: a consumer
    // must be able to import it from a server module.
    entry: { "core/index": "src/core/index.ts" },
    format: ["esm"],
    dts: true,
    sourcemap: true,
    clean: false, // the other pass already cleaned; a second clean:true here would
    // race it (both passes run concurrently) and non-deterministically wipe the
    // other's output.
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
