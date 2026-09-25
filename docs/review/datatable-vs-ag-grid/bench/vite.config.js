import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { resolve } from "path";
export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    rollupOptions: {
      input: { ours: resolve(__dirname, "ours.html"), ag: resolve(__dirname, "ag.html") },
    },
    sourcemap: false,
    cssMinify: false,
  },
});
