/**
 * DG-24 — the catalog read model (plan §4.1, V9). One instance for the whole app: the catalog
 * pages, DG-25's details card, DG-28's language service, DG-29's palette and DG-23's health
 * tile read it. The dev server merges `public/icons/index.json`, `catalog/<vendor>.yaml` and
 * `catalog/parts/<vendor>.yaml` (`server/catalog-fs.mjs`); this module fetches the result and
 * reloads it on the server's `catalog` event. It never writes: in R1 the catalog is written by
 * the MCP fill loop and corrected by hand in the YAML.
 *
 * Without the dev server (`vite preview`, a static build) there is no `/api/catalog`: the
 * service falls back to the bundled catalog (DG-26 1b.3: every icon plus the catalog files as
 * built, `live: false`).
 */
import { useSyncExternalStore } from "react";
import { nearestName } from "../spec/dialect/nearest-name";
import { onServerEvent } from "../workspace/live-reload";
import { BUNDLED_CATALOG, setCatalogEntries } from "./catalog-bundle"; // DG-26
import type { CatalogEntry } from "./catalog-entry"; // DG-26

export type { CatalogEntry, CatalogPart } from "./catalog-entry"; // DG-26

export const CATALOG_URL = "/api/catalog";
/** The named server event (`server/workspace-plugin.mjs` `watchCatalog`). */
export const CATALOG_EVENT = "catalog";
/** Generic glyphs: in the catalog as icons, never filled or edited. */
export const LUCIDE_VENDOR = "lucide";

interface CatalogState {
  entries: ReadonlyMap<string, CatalogEntry>;
  /** Files or entries the server skipped (a YAML error, a part without a known icon). */
  problems: readonly string[];
  /** `true` once the first load settled. */
  loaded: boolean;
  /** `true` once the dev server's merged catalog loaded; `false` on the index fallback. */
  live: boolean;
  /** Last live-source failure. Bundled entries may still be usable. */
  error: string | null;
}

let state: CatalogState = {
  entries: new Map(),
  problems: [],
  loaded: false,
  live: false,
  error: null,
};
const listeners = new Set<() => void>();

function set(next: Partial<CatalogState>) {
  state = { ...state, ...next };
  for (const fn of listeners) fn();
}

async function errorOf(res: Response): Promise<Error> {
  const body = (await res.json().catch(() => null)) as { error?: string } | null;
  return new Error(body?.error ?? `The catalog answered ${res.status}.`);
}

// DG-26 — two overlapping load()s (a fast reload while the first is in flight) could resolve
// out of order and install stale entries; a request ignores its own result once a later one
// has started.
let loadSeq = 0;

async function load(): Promise<void> {
  const seq = ++loadSeq;
  try {
    const res = await fetch(`${CATALOG_URL}/all`);
    if (seq !== loadSeq) return;
    if (!res.ok) throw await errorOf(res);
    const body = (await res.json()) as { entries: CatalogEntry[]; problems: string[] };
    if (seq !== loadSeq) return;
    set({
      entries: new Map(body.entries.map((e) => [e.name, e])),
      problems: body.problems,
      loaded: true,
      live: true,
      error: null,
    });
    setCatalogEntries(body.entries); // DG-26 — keeps catalog references live (1b.4)
  } catch (error) {
    if (seq !== loadSeq) return;
    // A failed reload keeps the merged catalog it has; only the first load falls back.
    if (!state.live) {
      set({
        entries: new Map(BUNDLED_CATALOG.entries.map((e) => [e.name, e])),
        problems: BUNDLED_CATALOG.problems,
        loaded: true,
        error: error instanceof Error ? error.message : "The catalog could not be loaded.",
      });
    } else {
      set({
        error: error instanceof Error ? error.message : "The catalog could not be refreshed.",
      });
    }
  }
}

let first: Promise<void> | null = null;
function ensureLoaded(): Promise<void> {
  first ??= load();
  return first;
}

onServerEvent(CATALOG_EVENT, () => void load());

const fillable = (e: CatalogEntry) => e.vendor !== LUCIDE_VENDOR;

export const catalogService = {
  /** Resolves once the first load settled (merged catalog, or the index fallback). */
  ready(): Promise<void> {
    return ensureLoaded();
  },
  /** Retry the live source while retaining the last usable catalog. */
  retry(): Promise<void> {
    return load();
  },
  state(): CatalogState {
    return state;
  },
  get(name: string): CatalogEntry | undefined {
    return state.entries.get(name);
  },
  all(): CatalogEntry[] {
    return [...state.entries.values()];
  },
  search(
    q: string,
    opts: { vendor?: string; tags?: string[]; limit?: number } = {},
  ): CatalogEntry[] {
    const needle = q.trim().toLowerCase();
    const out: CatalogEntry[] = [];
    for (const e of state.entries.values()) {
      if (opts.vendor && e.vendor !== opts.vendor) continue;
      if (opts.tags?.length && !opts.tags.every((t) => e.tags.includes(t))) continue;
      const hay = [e.name, e.label, ...e.aliases, ...e.tags].join(" ").toLowerCase();
      if (needle && !hay.includes(needle)) continue;
      out.push(e);
      if (opts.limit !== undefined && out.length >= opts.limit) break;
    }
    return out;
  },
  /** The nearest icon name (not a part: a node's `icon:` must be an icon). */
  suggest(name: string): string | undefined {
    const icons = [...state.entries.values()].filter((e) => !e.part).map((e) => e.name);
    return nearestName(name, icons);
  },
  vendors(): { vendor: string; count: number }[] {
    const counts = new Map<string, number>();
    for (const e of state.entries.values()) {
      counts.set(e.vendor, (counts.get(e.vendor) ?? 0) + 1);
    }
    return [...counts]
      .map(([vendor, count]) => ({ vendor, count }))
      .sort((a, b) => a.vendor.localeCompare(b.vendor));
  },
  /** Health (DG-23's tile): generic `lucide/*` glyphs are never counted. */
  stats(): { total: number; withoutDescription: number; docsUnverified: number } {
    let total = 0;
    let withoutDescription = 0;
    let docsUnverified = 0;
    for (const e of state.entries.values()) {
      if (!fillable(e)) continue;
      total++;
      if (!e.description) withoutDescription++;
      if (e.docsUnverified) docsUnverified++;
    }
    return { total, withoutDescription, docsUnverified };
  },
  subscribe(fn: () => void): () => void {
    void ensureLoaded();
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  },
};

/** One entry, live (`undefined` while loading or for an unknown name). */
export function useCatalogEntry(name: string | undefined): CatalogEntry | undefined {
  return useSyncExternalStore(catalogService.subscribe, () =>
    name === undefined ? undefined : catalogService.get(name),
  );
}

/** The whole catalog state, live (the catalog pages). */
export function useCatalog(): CatalogState {
  return useSyncExternalStore(catalogService.subscribe, catalogService.state);
}
