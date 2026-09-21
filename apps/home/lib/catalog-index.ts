/**
 * catalog-index.ts — the small half of the generated catalogue: what navigation and search need.
 * Safe to import from client components.
 */
import indexJson from "../content/generated/catalog-index.json";

import familyOrderJson from "../content/generated/catalog-family-order.json";

/**
 * Explore holds what the components add up to — templates, blocks, visualizations; everything a
 * package exports (the chart types included) is a component.
 */
export type CatalogSection = "components" | "visualizations" | "blocks" | "templates";

export interface CatalogEntry {
  section: CatalogSection;
  slug: string;
  name: string;
  group: string;
  package: string;
  component: string | null;
  summary: string;
  /** The question a block answers (its Storybook docs subtitle), or "". */
  question: string;
  /** The registry item behind a block page, or null. */
  block: string | null;
  stories: number;
  /** The first story's id — the entry's thumbnail. */
  first: string | null;
  /** 1-based place on its branch's top-level listing; 0 when it only shows in its family. */
  featured: number;
}

export const CATALOG_INDEX = indexJson as CatalogEntry[];

export function hrefOf(entry: Pick<CatalogEntry, "section" | "slug" | "package">): string {
  return entry.section === "components"
    ? `/components/${entry.package}/${entry.slug}`
    : `/${entry.section}/${entry.slug}`;
}

/** Reading order of a package's website families (`scripts/lib/home-catalog-layout.json`). */
export const PACKAGE_FAMILY_ORDER = familyOrderJson as Record<string, string[]>;

/** Storybook's own id sanitiser, close enough for family labels ("KPI Cards" → "kpi-cards"). */
export const familySlug = (label: string) =>
  label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

/** A branch is one rail entry: a section, or one package under Components. */
export const branchHref = (entry: Pick<CatalogEntry, "section" | "package">) =>
  entry.section === "components" ? `/components/${entry.package}` : `/${entry.section}`;

/** A family's own listing page. The static `group` segment keeps it clear of detail slugs. */
export const familyHref = (entry: Pick<CatalogEntry, "section" | "package" | "group">) =>
  `${branchHref(entry)}/group/${familySlug(entry.group)}`;
