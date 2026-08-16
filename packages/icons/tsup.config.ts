import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  dts: true,
  sourcemap: true,
  clean: true,
  // Dependencies & peerDependencies are externalized by tsup automatically.
  external: ["react", "react-dom"],
});
