/**
 * DG-24 — a node for one catalog entry in dialect v1: what MCP `catalog_get` returns as `yaml`
 * and what the entry page copies. One function for both (the server reaches it through
 * `server-surface.ts`). React-free. DG-26 (1b): reference-first — a real catalog item
 * (not a glyph) writes `ref:`, not a copy of its title/icon/subtitle/badges.
 */
import { GLYPH_VENDOR } from "../spec/dialect/catalog-refs";
import { nodeItem, type NewEntryValue } from "../spec/dialect/entry-text";

export interface SnippetEntry {
  name: string;
  vendor: string;
  slug: string;
  label: string;
  icon: string;
  kind?: string;
  part?: { subtitle?: string; badges?: readonly string[] };
}

/** An id starts with a letter (dialect v1); an icon stem like "3scale" gets a prefix. */
function idOf(slug: string): string {
  return /^[a-z]/.test(slug) ? slug : `n-${slug}`;
}

/**
 * `aws/lambda` → `- id: lambda\n  ref: catalog/aws/lambda\n`. A generic glyph (Ruling 7:
 * `catalog/lucide/*` is never a reference) still copies icon/title/subtitle/badges.
 */
export function entrySnippet(e: SnippetEntry): string {
  if (e.vendor === GLYPH_VENDOR) {
    const fields: Record<string, NewEntryValue> = {
      id: idOf(e.slug),
      ...(e.kind && e.kind !== "service" ? { type: e.kind } : {}),
      icon: e.icon,
      title: e.label,
      ...(e.part?.subtitle ? { subtitle: e.part.subtitle } : {}),
      ...(e.part?.badges?.length ? { badges: e.part.badges } : {}),
    };
    return nodeItem(fields);
  }
  return nodeItem({ id: idOf(e.slug), ref: `catalog/${e.name}` });
}
