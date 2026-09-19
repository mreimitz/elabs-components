/**
 * catalog-index.ts — the small half of the generated catalogue: what navigation and search need.
 * Safe to import from client components.
 */
import indexJson from "../content/generated/catalog-index.json";

export type CatalogSection = "components" | "charts" | "blocks" | "templates";

export interface CatalogEntry {
  section: CatalogSection;
  slug: string;
  name: string;
  group: string;
  package: string;
  component: string | null;
  summary: string;
  stories: number;
  /** The first story's id — the entry's thumbnail. */
  first: string | null;
}

export const CATALOG_INDEX = indexJson as CatalogEntry[];

export function hrefOf(entry: Pick<CatalogEntry, "section" | "slug" | "package">): string {
  return entry.section === "components"
    ? `/components/${entry.package}/${entry.slug}`
    : `/${entry.section}/${entry.slug}`;
}
