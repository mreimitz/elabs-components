import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
// DG-21: the workspace service (`/api/workspace/*` + SSE), dev server only.
import { atlasViewer } from "./server/viewer-plugin.mjs";
import { atlasWorkspace } from "./server/workspace-plugin.mjs";

export default defineConfig({
  plugins: [react(), tailwindcss(), atlasWorkspace(), atlasViewer()],
});
