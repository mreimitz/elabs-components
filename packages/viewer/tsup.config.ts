import { defineConfig } from "tsup";
import { moduleEntries } from "../../scripts/lib/tsup-modules.mjs";

const PUBLIC = { index: "src/index.ts" };

export default defineConfig({
  // One output file per source module (RM-130, scripts/lib/tsup-modules.mjs), so an
  // app's bundler drops the modules it never reaches; types stay on the public entry.
  entry: moduleEntries(PUBLIC),
  format: ["esm"],
  dts: { entry: PUBLIC },
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
