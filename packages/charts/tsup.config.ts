import { defineConfig } from "tsup";

// Two passes, because the `./test` double module must NOT bundle any @visx/d3
// engine even though esbuild would happily tree-shake-in a shared chunk if it
// ran in the SAME pass as the main barrel (a shared-chunk dependency edge is
// exactly what `pnpm charts:test-double:check`'s engine-isolation rung exists
// to catch at the SOURCE level, before a bundler could ever paper over it).
// Entries use the object form so output paths are explicit: tsup derives the
// out-dir from the common base of a pass's entries, so an array would emit
// dist/index.js for both entries and silently break
// publishConfig.exports["./test"] (the editor package's tsup.config.ts carries
// the same warning).
export default defineConfig([
  {
    entry: { index: "src/index.ts" },
    format: ["esm"],
    dts: true,
    sourcemap: true,
    clean: true,
    // esbuild strips per-module "use client" directives when it bundles, so the
    // 128 directives in src/ never reach dist/. Re-assert it for the whole bundle.
    banner: { js: '"use client";' },
    // Dependencies & peerDependencies are externalized by tsup automatically.
    external: ["react", "react-dom"],
  },
  {
    // The test-double leaf — dependency-free (no @visx/d3/motion), so a
    // consumer's test setup can import it without pulling the rendering engine.
    entry: { "test/index": "src/test/index.ts" },
    format: ["esm"],
    dts: true,
    sourcemap: true,
    clean: false, // the other pass already cleaned; a second clean:true here
    // would race it (both passes run concurrently) and non-deterministically
    // wipe the other's output.
    banner: { js: '"use client";' },
    external: ["react", "react-dom"],
  },
]);
