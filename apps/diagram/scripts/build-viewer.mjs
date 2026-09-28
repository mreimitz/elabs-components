import { build } from "vite";
import { createRequire } from "node:module";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath } from "node:url";
import { resolve, dirname } from "node:path";
import { mkdir, writeFile } from "node:fs/promises";
const require = createRequire(import.meta.url);
const tailwindEntry = createRequire(require.resolve("@tailwindcss/vite")).resolve(
  "tailwindcss/index.css",
);
const root = fileURLToPath(new URL("../", import.meta.url));
const adapters = new Map(
  Object.entries({
    "viewer/capabilities": "capabilities",
    "style/config-service": "style-config",
    "catalog/catalog-bundle": "catalog",
    "catalog/catalog-service": "catalog",
    "state/component-files": "components",
    "shell/mode-store": "mode",
    "workspace/workspace-store": "workspace",
    "shell/diagram-shell": "shell",
    "icons/icon-names": "icons",
    "icons/register-packs": "icons",
  }).map(([source, target]) => [
    resolve(root, `src/${source}`),
    resolve(root, `src/viewer/adapters/${target}.ts`),
  ]),
);
export async function buildViewer({ writePublic = false } = {}) {
  const result = await build({
    configFile: false,
    root,
    publicDir: false,
    define: { "process.env.NODE_ENV": JSON.stringify("production") },
    resolve: { alias: [{ find: /^tailwindcss$/, replacement: tailwindEntry }] },
    plugins: [
      {
        name: "embedded-viewer-adapters",
        enforce: "pre",
        resolveId(source, importer) {
          if (source.endsWith("workspace/examples/lakehouse-aws.yaml?raw")) return "\0viewer-seed";
          if (importer && source.startsWith("."))
            return adapters.get(resolve(dirname(importer), source).replace(/\.(tsx?|jsx?)$/, ""));
        },
        load(id) {
          if (id === "\0viewer-seed")
            return `import {snapshot} from ${JSON.stringify(resolve(root, "src/viewer/snapshot.ts"))};export default snapshot.documents[snapshot.root];`;
        },
      },
      react(),
      tailwindcss(),
    ],
    build: {
      write: false,
      minify: true,
      assetsInlineLimit: Infinity,
      cssCodeSplit: false,
      lib: { entry: resolve(root, "src/viewer/main.tsx"), formats: ["iife"], name: "AtlasViewer" },
      rollupOptions: { output: { inlineDynamicImports: true } },
    },
  });
  const outputs = (Array.isArray(result) ? result : [result]).flatMap((r) => r.output);
  const code = outputs
    .filter((o) => o.type === "chunk")
    .map((o) => o.code)
    .join("\n");
  const css = outputs
    .filter((o) => o.type === "asset" && o.fileName.endsWith(".css"))
    .map((o) => o.source)
    .join("\n");
  const extra = outputs.filter((o) => o.type === "asset" && !o.fileName.endsWith(".css"));
  if (extra.length)
    throw Error(`Viewer has external assets: ${extra.map((o) => o.fileName).join(", ")}`);
  const forbidden = outputs
    .filter((o) => o.type === "chunk")
    .flatMap((o) =>
      Object.entries(o.modules)
        .filter(
          ([id, info]) =>
            info.renderedLength > 0 &&
            /src\/(workspace\/(client|live-reload|use-autosave)|catalog\/catalog-(service|bundle)|style\/config-service|panes\/editor-pane)\./.test(
              id,
            ),
        )
        .map(([id]) => id),
    );
  if (forbidden.length) throw Error(`Viewer contains authoring services: ${forbidden.join(", ")}`);
  const template = { code, css };
  await mkdir(resolve(root, ".viewer"), { recursive: true });
  await writeFile(resolve(root, ".viewer/template.json"), JSON.stringify(template));
  if (writePublic)
    await writeFile(resolve(root, "public/viewer.template.json"), JSON.stringify(template));
  return template;
}
if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1]))
  await buildViewer({ writePublic: !process.argv.includes("--private") });
