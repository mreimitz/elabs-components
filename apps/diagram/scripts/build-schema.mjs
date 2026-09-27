import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { runnerImport } from "vite";

const root = fileURLToPath(new URL("..", import.meta.url));
const { module } = await runnerImport(
  fileURLToPath(new URL("../src/spec/dialect/schema.ts", import.meta.url)),
  {
    root,
    configFile: false,
    logLevel: "error",
  },
);
// DG-26 — v1 only, from here on: the v0 file stays on disk, frozen, for v0 fixtures.
const schema = module.buildArchSchema();
mkdirSync(new URL("../schema/", import.meta.url), { recursive: true });
writeFileSync(
  new URL("../schema/arch-diagram.v1.schema.json", import.meta.url),
  `${JSON.stringify(schema, null, 2)}\n`,
);
console.log(`arch-diagram.v1.schema.json: ${Object.keys(schema.$defs).length} $defs`);
