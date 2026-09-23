/**
 * catalog-nav.ts — the smallest cut of the generated catalogue: what the client shell renders at
 * first paint (the rail, breadcrumbs, the Start picker) and the address helpers every page uses.
 * Safe to import from client components. The search text (`summary`, `question`) lives in
 * `catalog-index.json`, loaded on demand through `loadCatalogIndex()` so the home page's initial
 * JS does not carry every summary (`pnpm check --rule home-bundle`).
 */
import navJson from "../content/generated/catalog-nav.json";
import familyOrderJson from "../content/generated/catalog-family-order.json";

/**
 * Explore holds what the components add up to — templates, blocks, visualizations; everything a
 * package exports (the chart types included) is a component.
 */
export type CatalogSection = "components" | "visualizations" | "blocks" | "templates";

/** One catalogue page as navigation sees it. */
export interface CatalogNavEntry {
  section: CatalogSection;
  slug: string;
  name: string;
  group: string;
  package: string;
  component: string | null;
}

/** A full index record: the nav fields plus what search and the listings render. */
export interface CatalogEntry extends CatalogNavEntry {
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

export const CATALOG_NAV = navJson as CatalogNavEntry[];

/** The full index, fetched as its own chunk the first time a client needs the search text. */
export const loadCatalogIndex = (): Promise<CatalogEntry[]> =>
  import("../content/generated/catalog-index.json").then(
    (module) => module.default as CatalogEntry[],
  );

export function hrefOf(entry: Pick<CatalogNavEntry, "section" | "slug" | "package">): string {
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
export const branchHref = (entry: Pick<CatalogNavEntry, "section" | "package">) =>
  entry.section === "components" ? `/components/${entry.package}` : `/${entry.section}`;

/** A family's own listing page. The static `group` segment keeps it clear of detail slugs. */
export const familyHref = (entry: Pick<CatalogNavEntry, "section" | "package" | "group">) =>
  `${branchHref(entry)}/group/${familySlug(entry.group)}`;
