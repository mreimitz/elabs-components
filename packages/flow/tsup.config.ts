import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  dts: true,
  sourcemap: true,
  clean: true,
  // esbuild strips per-module "use client" directives when it bundles; the React
  // Flow canvas is client-only, so re-assert it for the whole bundle.
  banner: { js: '"use client";' },
  // Dependencies & peerDependencies are externalized by tsup automatically.
  external: ["react", "react-dom"],
});
