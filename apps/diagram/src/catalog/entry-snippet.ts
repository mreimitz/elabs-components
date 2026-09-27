/**
 * DG-24 — a node for one catalog entry in dialect v0: what MCP `catalog_get` returns as `yaml`
 * and what the entry page copies. One function for both (the server reaches it through
 * `server-surface.ts`). React-free.
 */
import { nodeItem, type NewEntryValue } from "../spec/dialect/entry-text";

export interface SnippetEntry {
  slug: string;
  label: string;
  icon: string;
  kind?: string;
  part?: { subtitle?: string; badges?: readonly string[] };
}

/** `aws/lambda` → `- id: lambda\n  icon: aws/lambda\n  title: AWS Lambda\n`. */
export function entrySnippet(e: SnippetEntry): string {
  const fields: Record<string, NewEntryValue> = {
    // An id starts with a letter (dialect v0); an icon stem like "3scale" gets a prefix.
    id: /^[a-z]/.test(e.slug) ? e.slug : `n-${e.slug}`,
    ...(e.kind && e.kind !== "service" ? { type: e.kind } : {}),
    icon: e.icon,
    title: e.label,
    ...(e.part?.subtitle ? { subtitle: e.part.subtitle } : {}),
    ...(e.part?.badges?.length ? { badges: e.part.badges } : {}),
  };
  return nodeItem(fields);
}
