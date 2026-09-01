import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    css: false,
    testTimeout: 12_000,
  },
  resolve: {
    alias: {
      // mammoth ships a `browser` field that swaps its two Node-only modules
      // (both `require("fs")`) for `ArrayBuffer` equivalents — which is what a
      // real bundler gives the docx adapter, and why it passes `{ arrayBuffer }`.
      // Vitest resolves dependencies through Node, where that mapping does not
      // apply, so without this the test would exercise a module graph no browser
      // ever sees. `mammoth.browser.js` is mammoth's own published browser
      // build: the same swap, pre-bundled.
      mammoth: "mammoth/mammoth.browser.js",
    },
  },
});
