import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  dts: true,
  sourcemap: true,
  clean: true,
  // esbuild strips per-module "use client" directives when it bundles; MapLibre
  // needs WebGL so the whole surface is client-only. Re-assert it for the bundle.
  banner: { js: '"use client";' },
  // Dependencies & peerDependencies are externalized by tsup automatically.
  external: ["react", "react-dom"],
});
