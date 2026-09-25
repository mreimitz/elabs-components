import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { resolve } from "node:path";

const pkg = (name) => resolve(__dirname, `../../packages/${name}/src/index.ts`);

// DataTable is rendered from WORKSPACE SOURCE (the packages' own `exports` point
// at src/), so a budget run measures the branch under test, never npm.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    dedupe: ["react", "react-dom"],
    alias: [
      { find: /^@elabs-ai\/components-data$/, replacement: pkg("data") },
      { find: /^@elabs-ai\/components-tokens$/, replacement: pkg("tokens") },
      { find: /^@elabs-ai\/components-ui$/, replacement: pkg("ui") },
      { find: /^@elabs-ai\/components-icons$/, replacement: pkg("icons") },
    ],
  },
  build: {
    cssMinify: false,
    minify: process.env.PROFILE ? false : "oxc",
    rollupOptions: {
      input: { ours: resolve(__dirname, "ours.html"), ag: resolve(__dirname, "ag.html") },
    },
  },
});
