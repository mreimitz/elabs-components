/**
 * The engine-free A2UI core: protocol types, the catalog schema, the validator,
 * the streaming JSON completer and the JSON-Schema builder. No React here —
 * `pnpm gen` bundles this folder into the `brand-ui a2ui` CLI verbs.
 */
export * from "./spec";
export * from "./validate";
export * from "./complete-json";
export * from "./schema";
export { A2UI_CATALOG_SCHEMA, A2UI_CATALOG_VERSION } from "./catalog.generated";
