/**
 * The A2UI catalog-schema shape, restated structurally: `data` may not import
 * `@elabs-ai/components-ai` (one-way dependency graph). Assignable to ai's
 * `A2uiCatalogTypeSchema`, which `createA2uiCatalog` checks at the call site.
 */
export interface DataA2uiPropSchema {
  type: "string" | "number" | "boolean" | "node" | "array" | "object" | "any";
  enum?: (string | number)[];
  required?: boolean;
  /** JSON-compatible, like ai's `A2uiJson`. */
  default?: string | number | boolean | null | object;
  description?: string;
}

export interface DataA2uiTypeSchema {
  builtin?: boolean;
  children: boolean;
  summary?: string;
  props: Record<string, DataA2uiPropSchema>;
  events: Record<string, string>;
  source: string;
}

export type DataA2uiCatalogSchema = Record<string, DataA2uiTypeSchema>;
