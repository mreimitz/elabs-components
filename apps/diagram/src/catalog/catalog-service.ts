/**
 * DG-24 — the catalog read model (plan §4.1, V9). One instance for the whole app: the catalog
 * pages, DG-25's details card, DG-28's language service, DG-29's palette and DG-23's health
 * tile read it. The dev server merges `public/icons/index.json`, `catalog/<vendor>.yaml` and
 * `catalog/parts/<vendor>.yaml` (`server/catalog-fs.mjs`); this module fetches the result and
 * reloads it on the server's `catalog` event. It never writes: in R1 the catalog is written by
 * the MCP fill loop and corrected by hand in the YAML.
 *
 * Without the dev server (`vite preview`, a static build) there is no `/api/catalog`: the
 * service falls back to the bundled icon index — every icon, no metadata (`live: false`).
 */
import { useSyncExternalStore } from "react";
import type { ArchNodeType } from "../spec/dialect";
import { nearestName } from "../spec/dialect/nearest-name";
import { onServerEvent } from "../workspace/live-reload";
import index from "../../public/icons/index.json";

export const CATALOG_URL = "/api/catalog";
/** The named server event (`server/workspace-plugin.mjs` `watchCatalog`). */
export const CATALOG_EVENT = "catalog";
/** Generic glyphs: in the catalog as icons, never filled or edited. */
export const LUCIDE_VENDOR = "lucide";

export interface CatalogPart {
  subtitle?: string;
  badges?: string[];
}

export interface CatalogEntry {
  /** "aws/lambda" (an icon) or "qlik/data-gateway-direct" (a part). */
  name: string;
  vendor: string;
  slug: string;
  /** Display name: the catalog's `name`, else the index label. */
  label: string;
  description?: string;
  docs?: string;
  /** The YAML `type:` a node of this entry defaults to (the dialect's own union). */
  kind?: ArchNodeType;
  tags: string[];
  aliases: string[];
  /** Set on a part: a preset node drawn with `icon`. */
  part?: CatalogPart;
  /** The icon name the entry draws with: `name` itself, or a part's `icon:`. */
  icon: string;
  /** false until the maintainer checks it (in the YAML); the MCP fill never overwrites true. */
  curated: boolean;
  /** The server could not reach `docs` when it was written. */
  docsUnverified?: boolean;
  /** From index.json (icons only). */
  iconPath?: string;
}

interface IndexEntry {
  path: string;
  label: string;
  pack: string;
}

/** The fallback: the bundled icon index, no metadata. */
function indexEntries(): CatalogEntry[] {
  return Object.entries(index as Record<string, IndexEntry>).map(([name, e]) => ({
    name,
    vendor: e.pack,
    slug: name.slice(e.pack.length + 1),
    label: e.label,
    tags: [],
    aliases: [],
    icon: name,
    curated: false,
    iconPath: e.path,
  }));
}

interface CatalogState {
  entries: ReadonlyMap<string, CatalogEntry>;
  /** Files or entries the server skipped (a YAML error, a part without a known icon). */
  problems: readonly string[];
  /** `true` once the first load settled. */
  loaded: boolean;
  /** `true` once the dev server's merged catalog loaded; `false` on the index fallback. */
  live: boolean;
}

let state: CatalogState = { entries: new Map(), problems: [], loaded: false, live: false };
const listeners = new Set<() => void>();

function set(next: Partial<CatalogState>) {
  state = { ...state, ...next };
  for (const fn of listeners) fn();
}

async function errorOf(res: Response): Promise<Error> {
  const body = (await res.json().catch(() => null)) as { error?: string } | null;
  return new Error(body?.error ?? `The catalog answered ${res.status}.`);
}

async function load(): Promise<void> {
  try {
    const res = await fetch(`${CATALOG_URL}/all`);
    if (!res.ok) throw await errorOf(res);
    const body = (await res.json()) as { entries: CatalogEntry[]; problems: string[] };
    set({
      entries: new Map(body.entries.map((e) => [e.name, e])),
      problems: body.problems,
      loaded: true,
      live: true,
    });
  } catch {
    // A failed reload keeps the merged catalog it has; only the first load falls back.
    if (!state.live) {
      set({ entries: new Map(indexEntries().map((e) => [e.name, e])), loaded: true });
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
