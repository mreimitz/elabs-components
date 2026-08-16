/**
 * The built-in adapters, and the registry that has them all.
 *
 * Every entry is `manifest` (eager, plain data) + `() => import(…)` (lazy). The
 * manifests are imported statically ON PURPOSE — they are a few dozen bytes of
 * data each and answer "can this be opened, and what controls apply" with no
 * network. The parsers and renderers behind them are not.
 *
 * `pnpm heavy-deps:check` enforces the split: a static import of `papaparse`
 * (or, from P1, `pdfjs-dist`) fails CI, because those are optional peers — a
 * static edge does not merely bloat a chunk, it makes the package unresolvable
 * for every consumer that did not install that parser.
 */

import { codeManifest } from "./code/code-manifest";
import { csvManifest } from "./csv/csv-manifest";
import { docxManifest } from "./docx/docx-manifest";
import { markdownManifest } from "./markdown/markdown-manifest";
import { imageManifest } from "./image/image-manifest";
import { jsonManifest } from "./json/json-manifest";
import { mediaManifest } from "./media/media-manifest";
import { pdfManifest } from "./pdf/pdf-manifest";
import { pptxManifest } from "./pptx/pptx-manifest";
import { textManifest } from "./text/text-manifest";
import { xlsxManifest } from "./xlsx/xlsx-manifest";
import { createRegistry, type ViewerRegistry } from "../core/registry";

export {
  codeManifest,
  csvManifest,
  docxManifest,
  imageManifest,
  jsonManifest,
  markdownManifest,
  mediaManifest,
  pdfManifest,
  pptxManifest,
  textManifest,
  xlsxManifest,
};

/**
 * A registry with every built-in adapter registered.
 *
 * Call it per app (or per view) rather than sharing one module-level instance,
 * so one screen's `register()` override cannot leak into another's.
 */
export function createDefaultRegistry(): ViewerRegistry {
  const registry = createRegistry();
  registry.register(imageManifest, () => import("./image/image-adapter"));
  registry.register(jsonManifest, () => import("./json/json-adapter"));
  registry.register(csvManifest, () => import("./csv/csv-adapter"));
  registry.register(pdfManifest, () => import("./pdf/pdf-adapter"));
  registry.register(mediaManifest, () => import("./media/media-adapter"));
  registry.register(docxManifest, () => import("./docx/docx-adapter"));
  registry.register(xlsxManifest, () => import("./xlsx/xlsx-adapter"));
  registry.register(pptxManifest, () => import("./pptx/pptx-adapter"));
  registry.register(markdownManifest, () => import("./markdown/markdown-adapter"));
  registry.register(codeManifest, () => import("./code/code-adapter"));
  // Registered last and claiming only broad categories, so anything above wins
  // a file it names specifically. This is the "readable as text" backstop.
  registry.register(textManifest, () => import("./text/text-adapter"));
  return registry;
}
