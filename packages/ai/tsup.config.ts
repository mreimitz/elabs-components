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
  // esbuild strips per-module "use client" directives when it bundles, so the
  // 56 directives in src/ never reach dist/. Re-assert it for the whole bundle.
  banner: { js: '"use client";' },
  // Dependencies & peerDependencies are externalized by tsup automatically.
  external: ["react", "react-dom"],
});
