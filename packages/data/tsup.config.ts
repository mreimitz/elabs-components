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
  // DataTable uses useState/useRef/useEffect but src/ carries NO "use client"
  // directive, so this package has never been RSC-safe. Assert it at the bundle.
  banner: { js: '"use client";' },
  // Dependencies & peerDependencies are externalized by tsup automatically.
  external: ["react", "react-dom"],
});
