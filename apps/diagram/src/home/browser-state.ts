/** Home's browse controls. Route code owns hash navigation; this store holds its decoded view. */
import { useSyncExternalStore } from "react";
import { createStore } from "../state/create-store";

export type BrowserCollection = "recent" | "diagrams" | "components" | "templates" | "catalog";
export type BrowserSort = "recent" | "name" | "modified";
export type BrowserLayout = "grid" | "table";

export interface BrowserState {
  collection: BrowserCollection;
  folder: string;
  query: string;
  vendor: string;
  catalogKind: string;
  tag: string;
  sort: BrowserSort;
  layout: BrowserLayout;
  page: number;
}

const LAYOUT_KEY = "atlas.home.browser-layout.v1";
const SCROLL_PREFIX = "atlas.home.browser-scroll.v1:";
export const BROWSER_PAGE_SIZE = 48;

function storedLayout(): BrowserLayout {
  try {
    return localStorage.getItem(LAYOUT_KEY) === "table" ? "table" : "grid";
  } catch {
    return "grid";
  }
}

export const DEFAULT_BROWSER_STATE: BrowserState = {
  collection: "recent",
  folder: "",
  query: "",
  vendor: "",
  catalogKind: "",
  tag: "",
  sort: "recent",
  layout: storedLayout(),
  page: 1,
};

const collections: readonly BrowserCollection[] = [
  "recent",
  "diagrams",
  "components",
  "templates",
  "catalog",
];
const sorts: readonly BrowserSort[] = ["recent", "name", "modified"];

/** Parse only browser parameters; legacy `#catalog[/vendor[/entry]]` remains valid. */
export function parseBrowserParams(hash: string): BrowserState {
  const [head = "", ...tail] = hash.replace(/^#/, "").split("&");
  const params = new URLSearchParams(tail.join("&"));
  const collectionParam = params.get("collection");
  const collection =
    collections.find((value) => value === collectionParam) ??
    (head === "catalog" ||
    head.startsWith("catalog/") ||
    head === "icons" ||
    head.startsWith("icons/")
      ? "catalog"
      : "recent");
  const segments = head.split("/");
  const legacyVendor =
    (segments[0] === "catalog" || segments[0] === "icons") && segments.length === 2
      ? decodeSegment(segments[1] ?? "")
      : "";
  const folder = (params.get("folder") ?? "").slice(0, 512).replace(/^\/+|\/+$/g, "");
  const query = (params.get("q") ?? "").slice(0, 512);
  const vendor = (params.get("vendor") ?? legacyVendor).slice(0, 100);
  const catalogKind = (params.get("type") ?? "").slice(0, 100);
  const tag = (params.get("tag") ?? "").slice(0, 100);
  const sortParam = params.get("sort");
  const sort = sorts.find((value) => value === sortParam) ?? "recent";
  const pageParam = Number(params.get("page"));
  const page =
    Number.isSafeInteger(pageParam) && pageParam > 0 && pageParam < 100_000 ? pageParam : 1;
  return {
    collection,
    folder,
    query,
    vendor,
    catalogKind,
    tag,
    sort,
    page,
    layout: storedLayout(),
  };
}

function decodeSegment(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/** Suffix for `#home` or a catalog list route; layout is a local preference. */
export function browserParams(state: BrowserState): string {
  const params = new URLSearchParams();
  if (state.collection !== "recent") params.set("collection", state.collection);
  if (state.folder) params.set("folder", state.folder);
  if (state.query) params.set("q", state.query);
  if (state.vendor) params.set("vendor", state.vendor);
  if (state.catalogKind) params.set("type", state.catalogKind);
  if (state.tag) params.set("tag", state.tag);
  if (state.sort !== "recent") params.set("sort", state.sort);
  if (state.page > 1) params.set("page", String(state.page));
  const suffix = params.toString();
  return suffix ? `&${suffix}` : "";
}

export const browserStateStore = createStore<BrowserState>(DEFAULT_BROWSER_STATE);

export function useBrowserState(): BrowserState {
  return useSyncExternalStore(browserStateStore.subscribe, browserStateStore.get);
}

export const browserActions = {
  patch(patch: Partial<BrowserState>): void {
    const current = browserStateStore.get();
    const next = { ...current, ...patch };
    if (patch.collection && patch.collection !== current.collection) {
      if (patch.folder === undefined) next.folder = "";
      if (patch.vendor === undefined) next.vendor = "";
      if (patch.catalogKind === undefined) next.catalogKind = "";
      if (patch.tag === undefined) next.tag = "";
    }
    if (
      patch.query !== undefined ||
      patch.collection !== undefined ||
      patch.folder !== undefined ||
      patch.vendor !== undefined ||
      patch.catalogKind !== undefined ||
      patch.tag !== undefined ||
      patch.sort !== undefined
    ) {
      if (patch.page === undefined) next.page = 1;
    }
    if (next.layout !== current.layout) {
      try {
        localStorage.setItem(LAYOUT_KEY, next.layout);
      } catch {
        // The view still changes for this tab.
      }
    }
    if (
      Object.keys(next).every(
        (key) => next[key as keyof BrowserState] === current[key as keyof BrowserState],
      )
    )
      return;
    browserStateStore.set(next);
  },
  restore(hash: string): void {
    const next = parseBrowserParams(hash);
    const current = browserStateStore.get();
    if (
      Object.keys(next).every(
        (key) => next[key as keyof BrowserState] === current[key as keyof BrowserState],
      )
    )
      return;
    browserStateStore.set(next);
  },
};

/** Keep each route's scroll offset for Back; storage failures simply start at the top. */
export function rememberBrowserScroll(hash: string, y: number): void {
  if (!Number.isFinite(y) || y < 0) return;
  try {
    sessionStorage.setItem(`${SCROLL_PREFIX}${hash}`, String(Math.round(y)));
  } catch {
    // Optional session convenience.
  }
}

export function browserScroll(hash: string): number {
  try {
    const value = Number(sessionStorage.getItem(`${SCROLL_PREFIX}${hash}`));
    return Number.isFinite(value) && value > 0 ? value : 0;
  } catch {
    return 0;
  }
}
