/**
 * catalog-index.ts — the small half of the generated catalogue: one record per page with the
 * text search and the listings match on. Server components import it freely; a CLIENT component
 * imports `catalog-nav.ts` instead and calls `loadCatalogIndex()` when it needs the text, so the
 * summaries stay out of the initial JS (`pnpm check --rule home-bundle`).
 */
import indexJson from "../content/generated/catalog-index.json";
import type { CatalogEntry } from "./catalog-nav";

export {
  PACKAGE_FAMILY_ORDER,
  branchHref,
  familyHref,
  familySlug,
  hrefOf,
  loadCatalogIndex,
  type CatalogEntry,
  type CatalogNavEntry,
  type CatalogSection,
} from "./catalog-nav";

export const CATALOG_INDEX = indexJson as CatalogEntry[];
