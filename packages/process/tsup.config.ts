import { defineConfig } from "tsup";

// Two passes, because `./core` is the FRAMEWORK-FREE leaf (ADR 0034 / ADR 0006):
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
