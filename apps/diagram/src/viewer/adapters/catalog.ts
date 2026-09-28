import { catalogLookupOf } from "../../spec/dialect/catalog-refs";
import { snapshot } from "../snapshot";
const entries = new Map(snapshot.catalog.map((entry) => [entry.name, entry]));
const lookup = catalogLookupOf(snapshot.catalog);
export const BUNDLED_CATALOG = { entries: snapshot.catalog, problems: [] };
export const currentCatalog = () => lookup;
export const bundledCatalog = currentCatalog;
export const catalogVersion = () => 0;
export const onCatalogChange = () => () => {};
export const setCatalogEntries = () => {
  throw new Error("Published catalog is read-only.");
};
export const useCatalogEntry = (name: string | undefined) => (name ? entries.get(name) : undefined);
export const catalogService = {
  get: (name: string) => entries.get(name),
  ready: async () => {},
  all: () => snapshot.catalog,
  subscribe: () => () => {},
};
