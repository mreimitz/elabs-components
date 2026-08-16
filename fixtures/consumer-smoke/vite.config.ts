import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

/**
 * Rollup warnings that mean "this package is broken for consumers". Vite only
 * warns about these, so without escalating them a tarball with an unresolvable
 * subpath still "builds" and the gate reports success.
 *
 * Deliberately NOT escalated:
 *   MODULE_LEVEL_DIRECTIVE — fires on our own "use client" banners, which are
 *                            correct and required; this is Rollup noise.
 *   CIRCULAR_DEPENDENCY    — fires inside third-party deps (micromark), not ours.
 */
const FATAL = new Set(["UNRESOLVED_IMPORT", "MISSING_EXPORT"]);

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    // This gate asserts the packages RESOLVE and BUNDLE, not that the output is
    // production-shaped. Minifying + source-mapping a graph that contains
    // Monaco, MapLibre, mermaid, shiki, visx and Milkdown is what made the
    // GitHub runner die with "Ineffective mark-compacts near heap limit" while
    // the same build passed on a dev machine with more headroom. Terser/esbuild
    // minification is the memory peak and it buys this check nothing.
    minify: false,
    sourcemap: false,
    // Keep the module graph split instead of forcing one enormous chunk.
    chunkSizeWarningLimit: 100_000,
    rollupOptions: {
      onwarn(warning, defaultHandler) {
        if (warning.code && FATAL.has(warning.code)) {
          throw new Error(`[${warning.code}] ${warning.message}`);
        }
        defaultHandler(warning);
      },
    },
  },
});
