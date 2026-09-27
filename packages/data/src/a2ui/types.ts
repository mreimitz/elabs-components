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
  /** Kept in the catalog until 6.0.0 (ADR 0042 §8) — the replacement lives in `description`. */
  deprecated?: boolean;
  /** A closed set of alternative shapes (e.g. `Responsive<T>`) — valid against any one. */
  oneOf?: DataA2uiPropSchema[];
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
