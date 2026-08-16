import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  dts: true,
  sourcemap: true,
  clean: true,
  // esbuild strips per-module "use client" directives when it bundles. The whole
  // surface is client-only anyway — it reads files, mints object URLs and (from
  // P1) drives canvas and workers — so re-assert it for the bundle.
  banner: { js: '"use client";' },
  // Dependencies & peerDependencies are externalized by tsup automatically,
  // which is what keeps every optional parser peer out of the bundle.
  external: ["react", "react-dom"],
});
