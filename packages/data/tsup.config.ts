import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  dts: true,
  sourcemap: true,
  clean: true,
  // DataTable uses useState/useRef/useEffect but src/ carries NO "use client"
  // directive, so this package has never been RSC-safe. Assert it at the bundle.
  banner: { js: '"use client";' },
  // Dependencies & peerDependencies are externalized by tsup automatically.
  external: ["react", "react-dom"],
});
