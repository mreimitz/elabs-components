/**
 * catalog.ts — readers over the generated catalogue (`content/generated/catalog-*.json`,
 * written by `scripts/lib/home-catalog.mjs`). One record per Storybook docs page: a component,
 * a chart, a registry block or a template.
 *
 * SERVER ONLY for `catalogPage` (the pages file is large); `CATALOG_INDEX` is small and is what
 * the client sidebar and search import — through `catalog-index.ts`, never this module.
 */
import pagesJson from "../content/generated/catalog-pages.json";
import { CATALOG_INDEX, hrefOf, type CatalogEntry, type CatalogSection } from "./catalog-index";

export interface CatalogProp {
  name: string;
  optional?: boolean;
  type: string;
  description?: string;
}

export interface CatalogApi {
  name: string;
  extends: string[];
  props: CatalogProp[];
  variants: Record<string, string[]> | null;
  defaultVariants: Record<string, string> | null;
}

export interface CatalogIntent {
  purpose?: string;
  category?: string;
  relationships?: Partial<
    Record<"contains" | "usedInside" | "pairsWith" | "avoidNextTo", string[]>
  >;
  stateTokens?: Record<string, string>;
  antiPatterns?: string[];
  dataShapes?: string[];
  avoidWhen?: string;
}

export interface CatalogStory {
  id: string;
  name: string;
  description: string;
}

export interface CatalogPage {
  section: CatalogSection;
  slug: string;
  name: string;
  title: string;
  group: string;
  package: string;
  component: string | null;
  importFrom: string | null;
  docsId: string;
  file: string;
  summary: string;
  about: string;
  intent: CatalogIntent | null;
  api: CatalogApi[];
  stories: CatalogStory[];
  block: {
    name: string;
    title: string;
    description: string;
    categories: string[];
    dependencies: string[];
    registryDependencies: string[];
  } | null;
  template: { name: string; description: string; packages: string[] } | null;
}

const PAGES = pagesJson as unknown as Record<string, CatalogPage>;

const keyOf = (section: CatalogSection, slug: string, pkg?: string) =>
  section === "components" ? `components/${pkg}/${slug}` : `${section}/${slug}`;

export function catalogPage(section: CatalogSection, slug: string, pkg?: string) {
  return PAGES[keyOf(section, slug, pkg)] ?? null;
}

export function entriesOf(section: CatalogSection, pkg?: string): CatalogEntry[] {
  return CATALOG_INDEX.filter((e) => e.section === section && (!pkg || e.package === pkg));
}

/** Entries grouped by their Storybook group, groups in first-appearance order of `order`. */
export function grouped(entries: CatalogEntry[], order: readonly string[] = []) {
  const groups = new Map<string, CatalogEntry[]>();
  for (const entry of entries) {
    const list = groups.get(entry.group) ?? [];
    list.push(entry);
    groups.set(entry.group, list);
  }
  const rank = (g: string) => (order.indexOf(g) === -1 ? order.length : order.indexOf(g));
  return Array.from(groups.entries()).sort(
    (a, b) => rank(a[0]) - rank(b[0]) || a[0].localeCompare(b[0]),
  );
}

/** The catalogue entry whose component is `name`, for "pairs with" / "contains" links. */
export function entryForComponent(name: string): CatalogEntry | null {
  return CATALOG_INDEX.find((e) => e.component === name || e.name === name) ?? null;
}

export { CATALOG_INDEX, hrefOf };
export type { CatalogEntry, CatalogSection };
