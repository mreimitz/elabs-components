import { defineConfig } from "tsup";

// Two passes, because the entries have opposite server/client natures and
// tsup's `banner` applies to every file a pass emits (shared chunks included).
// Entries use the object form so output paths are explicit: tsup derives the
// out-dir from the common base of a pass's entries, so an array would emit
// dist/parse.js here and silently break publishConfig.exports["./markdown/parse"].
export default defineConfig([
  {
    // The editing surfaces: the lean Monaco barrel (".") and the opt-in
    // markdown suite ("./markdown" → Milkdown/Streamdown). Both are client-only
    // (Monaco touches browser globals at import). esbuild strips the per-module
    // "use client" directives when it bundles, so the 47 in src/ never reach
    // dist/ — re-assert it here or RSC consumers break on import.
    entry: { index: "src/index.ts", "markdown/index": "src/markdown/index.ts" },
    format: ["esm"],
    dts: true,
    sourcemap: true,
    // NOTE: neither pass cleans. tsup runs the two configs concurrently, so a
    // `clean: true` here races the other pass's output and non-deterministically
    // wipes its .d.ts. The build script does `rm -rf dist` up front instead.
    clean: false,
    banner: { js: '"use client";' },
    // Dependencies & peerDependencies are externalized by tsup automatically
    // (so @milkdown/kit, streamdown, remark-* stay external). monaco-editor
    // stays external so consumers' bundler owns its workers/CSS.
    external: ["react", "react-dom", "monaco-editor"],
  },
  {
    // The two pure, Monaco-free data leaves: frontmatter (js-yaml only) and the
    // markdown parser (unified/remark only). They exist precisely so a consumer
    // can use them from a server/RSC path or a unit test without the engine —
    // so they must NOT carry the "use client" directive.
    entry: {
      "markdown/frontmatter": "src/markdown/frontmatter.ts",
      "markdown/parse": "src/markdown/parse.ts",
    },
    format: ["esm"],
    dts: true,
    sourcemap: true,
    clean: false, // see the note above
    external: ["react", "react-dom", "monaco-editor"],
  },
  {
    // The Vite worker wiring. `?worker` is a Vite-only import suffix that the
    // CONSUMER's bundler must transform, so the specifiers are kept external and
    // pass through to the output verbatim. Emitting real JS (rather than the
    // raw .ts this used to ship via files:["src"]) means consumers don't have to
    // transpile TypeScript out of node_modules, which most bundlers refuse to do.
    entry: { "lib/monaco-environment": "src/lib/monaco-environment.ts" },
    format: ["esm"],
    dts: true,
    sourcemap: true,
    clean: false, // see the note above
    external: ["react", "react-dom", "monaco-editor", /\?worker$/],
  },
]);
