/**
 * DG-26 (1b.3) — the catalog the build ships: the same merge as the dev server's
 * `/api/catalog/all`, from the files as built. First paint, `vite preview`, static builds and
 * the spec-check page compile catalog references against it; the live catalog
 * (catalog-service.ts) replaces it once it loads.
 */
import { catalogLookupOf, type CatalogLookup } from "../spec/dialect/catalog-refs";
import type { CatalogEntry } from "./catalog-entry";
import { mergeCatalog, type IndexIcon } from "./catalog-merge";
import index from "../../public/icons/index.json";
import { ICON_NAMES } from "../icons/icon-names";

const VENDORS = import.meta.glob<string>("../../catalog/*.yaml", {
  query: "?raw",
  import: "default",
  eager: true,
});
const PARTS = import.meta.glob<string>("../../catalog/parts/*.yaml", {
  query: "?raw",
  import: "default",
  eager: true,
});

/** `"../../catalog/aws.yaml"` → `"aws"`; skips a name starting with "." (none today). */
function vendorsOf(files: Record<string, string>, prefix: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [path, text] of Object.entries(files)) {
    const name = path.slice(prefix.length, -".yaml".length);
    if (name.startsWith(".")) continue;
    out[name] = text;
  }
  return out;
}

export const BUNDLED_CATALOG: { entries: readonly CatalogEntry[]; problems: readonly string[] } =
  mergeCatalog({
    index: index as Record<string, IndexIcon>,
    iconNames: ICON_NAMES,
    vendors: vendorsOf(VENDORS, "../../catalog/"),
    parts: vendorsOf(PARTS, "../../catalog/parts/"),
  });

/**
 * The bundled catalog as a lookup (deterministic: the spec-check rows use it). Excludes the
 * generic glyphs (`catalogLookupOf`): a `ref:` never names one (Ruling 7), so a glyph name
 * here must miss and report `ref-missing`, not resolve.
 */
export function bundledCatalog(): CatalogLookup {
  return catalogLookupOf(BUNDLED_CATALOG.entries);
}

let live: CatalogLookup | null = null;
const listeners = new Set<() => void>();

/** catalog-service.ts calls this after every successful load; listeners are told. */
export function setCatalogEntries(entries: readonly CatalogEntry[]): void {
  live = catalogLookupOf(entries);
  for (const fn of listeners) fn();
}

export function onCatalogChange(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** The live catalog once loaded, else the bundled one. compileText's default. */
export function currentCatalog(): CatalogLookup {
  return live ?? bundledCatalog();
}
