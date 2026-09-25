"use client";

/**
 * The data half of the A2UI catalog (D2): every `@elabs-ai/components-data` type an
 * agent may name in a surface, bound to its component. The schema half
 * (`DATA_A2UI_CATALOG_SCHEMA`) is generated from `catalog.source.json` + the manifest.
 *
 * `ai` may not import `data`, so an app merges the halves itself:
 *
 * ```ts
 * import { A2UI_CATALOG_SCHEMA, UI_CATALOG_BINDINGS, createA2uiCatalog } from "@elabs-ai/components-ai";
 * import { DATA_A2UI_BINDINGS, DATA_A2UI_CATALOG_SCHEMA } from "@elabs-ai/components-data";
 *
 * const catalog = createA2uiCatalog(
 *   { ...UI_CATALOG_BINDINGS, ...DATA_A2UI_BINDINGS },
 *   { ...A2UI_CATALOG_SCHEMA, ...DATA_A2UI_CATALOG_SCHEMA },
 * );
 * ```
 */
import type { ComponentType } from "react";

import { AutoGrid } from "../auto-grid";

// Erased at the catalog boundary: props are validated against the generated schema.
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- see above
type AnyComponent = ComponentType<any>;

/** One binding per type in `DATA_A2UI_CATALOG_SCHEMA` (a test asserts the key sets match). */
export const DATA_A2UI_BINDINGS: Record<string, AnyComponent> = {
  AutoGrid,
};
