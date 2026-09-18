/**
 * The A2UI catalog-schema shape, restated here structurally: `charts` may not import
 * `@elabs-ai/components-ai` (one-way dependency graph), and the generated catalog for
 * this package needs a type. It is assignable to ai's `A2uiCatalogTypeSchema`, which
 * is what `createA2uiCatalog` checks at the call site.
 */
export interface ChartsA2uiPropSchema {
  type: "string" | "number" | "boolean" | "node" | "array" | "object" | "any";
  enum?: (string | number)[];
  required?: boolean;
  default?: unknown;
  description?: string;
}

export interface ChartsA2uiTypeSchema {
  builtin?: boolean;
  children: boolean;
  summary?: string;
  props: Record<string, ChartsA2uiPropSchema>;
  events: Record<string, string>;
  source: string;
}

export type ChartsA2uiCatalogSchema = Record<string, ChartsA2uiTypeSchema>;
