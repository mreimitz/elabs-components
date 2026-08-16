import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  dts: true,
  sourcemap: true,
  clean: true,
  // esbuild strips per-module "use client" directives when it bundles. ThemeProvider
  // /useTheme are client-only, so re-assert it once for the whole bundle.
  banner: { js: '"use client";' },
  external: ["react", "react-dom"],
});
