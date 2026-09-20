// registry: a2ui-parts — copied 2026-09-19
/**
 * The catalog this app lets an agent draw from: the shipped ui types plus the charts half.
 *
 * `@elabs-ai/components-ai` may not import `@elabs-ai/components-charts` (one-way package
 * graph), so the APP merges the two — which is also where an app adds its own domain types.
 */
import {
  A2UI_CATALOG_SCHEMA,
  UI_CATALOG_BINDINGS,
  createA2uiCatalog,
  type A2uiCatalogSchema,
} from "@elabs-ai/components-ai";
import { CHARTS_A2UI_BINDINGS, CHARTS_A2UI_CATALOG_SCHEMA } from "@elabs-ai/components-charts";

export const SHOWCASE_CATALOG_SCHEMA = {
  ...A2UI_CATALOG_SCHEMA,
  ...CHARTS_A2UI_CATALOG_SCHEMA,
} as unknown as A2uiCatalogSchema;

export const showcaseCatalog = createA2uiCatalog(
  { ...UI_CATALOG_BINDINGS, ...CHARTS_A2UI_BINDINGS },
  SHOWCASE_CATALOG_SCHEMA,
);
