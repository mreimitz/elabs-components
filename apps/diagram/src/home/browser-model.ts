/** Shared read model and selectors for Home's grid and table. No document writes. */
import { useEffect, useMemo, useSyncExternalStore } from "react";
import type { CatalogEntry } from "../catalog/catalog-entry";
import { useCatalog } from "../catalog/catalog-service";
import type { WorkspaceFile, WorkspaceTree } from "../workspace/client";
import {
  activateSearchIndex,
  indexStore,
  matchEntry,
  normalizeText,
  queryWords,
  type EntryMatch,
  type IndexEntry,
  type MatchRange,
} from "../workspace/search-index";
import { useWorkspace } from "../workspace/workspace-store";
import { type BrowseId, type OpenedItem, recentBrowseItems } from "./browser-history";
import { BROWSER_PAGE_SIZE, type BrowserState, useBrowserState } from "./browser-state";
import { thumbSrc } from "./thumbnail";

export type BrowseKind = "diagram" | "component" | "template" | "catalog";
interface BrowseBase {
  id: BrowseId;
  kind: BrowseKind;
  title: string;
  description: string;
}
export interface WorkspaceBrowseItem extends BrowseBase {
  source: "workspace";
  kind: "diagram" | "component" | "template";
  path: string;
  folder: string;
  mtime: number;
  thumbnail?: string;
  file: WorkspaceFile;
  index?: IndexEntry;
}
export interface CatalogBrowseItem extends BrowseBase {
  source: "catalog";
  kind: "catalog";
  vendor: string;
  capability?: string;
  icon: string;
  referenceId: string;
  catalog: CatalogEntry;
}
export type BrowseItem = WorkspaceBrowseItem | CatalogBrowseItem;

export type BrowserMatchField =
  | "title"
  | "fileName"
  | "folder"
  | "id"
  | "ref"
  | "boxTitle"
  | "subtitle"
  | "icon"
  | "description"
  | "name"
  | "vendor"
  | "alias"
  | "tag"
  | "capability";
export interface BrowserMatch {
  titleMatch: boolean;
  titleRanges?: MatchRange[];
  reasons?: { field: BrowserMatchField; text: string; ranges: MatchRange[] }[];
}
export interface BrowseHit {
  item: BrowseItem;
  match: BrowserMatch | null;
  openedAt?: number | null;
}
export interface BrowserResults {
  items: BrowseHit[];
  total: number;
  workspaceCount: number;
  catalogCount: number;
  folders: string[];
  page: number;
  pageCount: number;
}

const folderOf = (path: string) => path.slice(0, Math.max(0, path.lastIndexOf("/")));
const stemOf = (path: string) => (path.split("/").pop() ?? path).replace(/\.ya?ml$/i, "");
const visibleWorkspace = (file: WorkspaceFile) =>
  file.path !== "_trash" && !file.path.startsWith("_trash/");

export function buildBrowseItems(
  tree: WorkspaceTree | null,
  catalogEntries: Iterable<CatalogEntry>,
  indexEntries: readonly IndexEntry[] = [],
): BrowseItem[] {
  const indexed = new Map(indexEntries.map((entry) => [entry.path, entry]));
  const workspace: WorkspaceBrowseItem[] = (tree?.files ?? [])
    .filter(visibleWorkspace)
    .map((file) => {
      const entry = indexed.get(file.path);
      const index = entry?.mtime === file.mtime ? entry : undefined;
      const kind = file.path.startsWith("templates/") ? "template" : file.kind;
      return {
        id: `workspace:${file.path}`,
        source: "workspace",
        kind,
        title: file.title?.trim() || stemOf(file.path),
        description: index?.description ?? "",
        path: file.path,
        folder: folderOf(file.path),
        mtime: file.mtime,
        thumbnail: thumbSrc(file.path, file.hasThumb, file.mtime),
        file,
        ...(index ? { index } : {}),
      };
    });
  const catalog: CatalogBrowseItem[] = [];
  for (const entry of catalogEntries) {
    if (entry.vendor === "lucide") continue;
    catalog.push({
      id: `catalog:${entry.name}`,
      source: "catalog",
      kind: "catalog",
      title: entry.label,
      description: entry.description ?? "",
      vendor: entry.vendor,
      capability: entry.capability,
      icon: entry.icon,
      referenceId: `catalog/${entry.name}`,
      catalog: entry,
    });
  }
  return [...workspace, ...catalog];
}

function ranges(text: string, word: string): MatchRange[] {
  const chars = Array.from(text);
  let normalized = "";
  const offsets: number[] = [];
  let original = 0;
  for (const char of chars) {
    for (const folded of normalizeText(char)) {
      normalized += folded;
      offsets.push(original);
    }
    original += char.length;
  }
  const out: MatchRange[] = [];
  let from = 0;
  for (;;) {
    const at = normalized.indexOf(word, from);
    if (at < 0) break;
    const start = offsets[at] ?? 0;
    out.push({ start, end: (offsets[at + word.length - 1] ?? start) + 1 });
    from = at + Math.max(word.length, 1);
  }
  return out;
}

function catalogMatch(item: CatalogBrowseItem, words: readonly string[]): BrowserMatch | null {
  const fields: { field: BrowserMatchField; text: string; weight: number }[] = [
    { field: "title", text: item.title, weight: 100 },
    { field: "name", text: item.catalog.name, weight: 90 },
    { field: "ref", text: item.referenceId, weight: 90 },
    { field: "vendor", text: item.vendor, weight: 45 },
    ...item.catalog.aliases.map((text) => ({ field: "alias" as const, text, weight: 75 })),
    ...item.catalog.tags.map((text) => ({ field: "tag" as const, text, weight: 40 })),
    ...(item.capability
      ? [{ field: "capability" as const, text: item.capability, weight: 55 }]
      : []),
    ...(item.description
      ? [{ field: "description" as const, text: item.description, weight: 25 }]
      : []),
  ];
  const hits = fields
    .map((field) => ({
      ...field,
      words: words.flatMap((word, index) =>
        normalizeText(field.text).includes(word) ? [index] : [],
      ),
    }))
    .filter((field) => field.words.length > 0);
  const covered = new Set(hits.find((hit) => hit.field === "title")?.words ?? []);
  if (new Set(hits.flatMap((hit) => hit.words)).size !== words.length) return null;
  const reasons: NonNullable<BrowserMatch["reasons"]> = [];
  while (covered.size < words.length) {
    const best = hits
      .filter((hit) => hit.words.some((index) => !covered.has(index)))
      .sort(
        (a, b) =>
          b.words.filter((index) => !covered.has(index)).length -
            a.words.filter((index) => !covered.has(index)).length || b.weight - a.weight,
      )[0]!;
    reasons.push({
      field: best.field,
      text: best.text,
      ranges: words.flatMap((word) => ranges(best.text, word)),
    });
    best.words.forEach((index) => covered.add(index));
  }
  return {
    titleMatch: reasons.length === 0,
    titleRanges: words.flatMap((word) => ranges(item.title, word)),
    reasons,
  };
}

function fallbackIndex(item: WorkspaceBrowseItem): IndexEntry {
  return {
    path: item.path,
    fileName: item.path.split("/").pop() ?? item.path,
    stem: stemOf(item.path),
    folder: item.folder,
    title: item.title,
    description: item.description,
    mtime: item.mtime,
    boxes: [],
  };
}

function score(item: BrowseItem, query: string, match: BrowserMatch): number {
  const needle = normalizeText(query.trim());
  const title = normalizeText(item.title);
  const identity = normalizeText(
    item.source === "workspace" ? stemOf(item.path) : item.catalog.name,
  );
  if (title === needle) return 1000;
  if (identity === needle) return 980;
  if (title.startsWith(needle)) return 900;
  if (identity.startsWith(needle)) return 880;
  if (match.titleMatch) return 800;
  if (match.titleRanges?.length) return 700;
  const reason = match.reasons?.[0]?.field;
  return reason === "name" || reason === "fileName" || reason === "alias"
    ? 600
    : reason === "id" || reason === "ref"
      ? 500
      : reason === "description"
        ? 200
        : 300;
}

/** Accent-folded AND search, with explanations from the existing workspace content index. */
export function searchBrowseItems(items: readonly BrowseItem[], query: string): BrowseHit[] {
  const words = queryWords(query);
  if (words.length === 0) return items.map((item) => ({ item, match: null }));
  return items
    .flatMap((item) => {
      const match: BrowserMatch | null =
        item.source === "workspace"
          ? (matchEntry(
              item.index ?? fallbackIndex(item),
              item.folder.split("/").filter(Boolean),
              words,
            ) as EntryMatch | null)
          : catalogMatch(item, words);
      return match ? [{ item, match }] : [];
    })
    .sort(
      (a, b) =>
        (a.item.source === "workspace" ? 0 : 1) - (b.item.source === "workspace" ? 0 : 1) ||
        score(b.item, query, b.match!) - score(a.item, query, a.match!) ||
        a.item.title.localeCompare(b.item.title),
    );
}

function inCollection(item: BrowseItem, collection: BrowserState["collection"]): boolean {
  return (
    collection === "recent" ||
    (collection === "catalog"
      ? item.source === "catalog"
      : item.source === "workspace" && item.kind === collection.slice(0, -1))
  );
}

/** A page of at most 48; all counts refer to the filtered result set, not the page. */
export function browseResults(
  items: readonly BrowseItem[],
  state: BrowserState,
  history: readonly OpenedItem[],
  folderPaths: readonly string[] = [],
): BrowserResults {
  const searching = queryWords(state.query).length > 0;
  const recent = !searching && state.collection === "recent";
  const opened = recentBrowseItems(items, history);
  const times = new Map(opened.map(({ item, openedAt }) => [item.id, openedAt]));
  const source = recent ? opened.map(({ item }) => item) : items;
  const baseFolder =
    state.folder ||
    (state.collection === "components"
      ? "components"
      : state.collection === "templates"
        ? "templates"
        : "");
  const filtered = source.filter(
    (item) =>
      inCollection(item, state.collection) &&
      (item.source !== "catalog" || !state.vendor || item.vendor === state.vendor) &&
      (item.source !== "catalog" ||
        !state.catalogKind ||
        item.catalog.kind === state.catalogKind) &&
      (item.source !== "catalog" || !state.tag || item.catalog.tags.includes(state.tag)) &&
      (item.source !== "workspace" ||
        !baseFolder ||
        item.folder === baseFolder ||
        item.folder.startsWith(`${baseFolder}/`)) &&
      (item.source !== "workspace" ||
        searching ||
        recent ||
        !state.folder ||
        item.folder === state.folder),
  );
  const hits = searching
    ? searchBrowseItems(filtered, state.query)
    : filtered.map((item) => ({ item, match: null }));
  if (!searching && !recent) {
    hits.sort((a, b) =>
      state.sort === "modified" && a.item.source === "workspace" && b.item.source === "workspace"
        ? b.item.mtime - a.item.mtime || a.item.title.localeCompare(b.item.title)
        : a.item.title.localeCompare(b.item.title),
    );
  }
  const pageCount = Math.max(1, Math.ceil(hits.length / BROWSER_PAGE_SIZE));
  const page = Math.min(Math.max(1, state.page), pageCount);
  const pageItems = hits
    .slice((page - 1) * BROWSER_PAGE_SIZE, page * BROWSER_PAGE_SIZE)
    .map((hit) => ({
      ...hit,
      ...(times.has(hit.item.id) ? { openedAt: times.get(hit.item.id) } : {}),
    }));
  const allowedFolder = (path: string) =>
    state.collection === "components"
      ? path.startsWith("components/")
      : state.collection === "templates"
        ? path.startsWith("templates/")
        : path !== "components" &&
          !path.startsWith("components/") &&
          path !== "templates" &&
          !path.startsWith("templates/") &&
          path !== "_trash" &&
          !path.startsWith("_trash/");
  const folders =
    state.collection === "catalog" || state.collection === "recent"
      ? []
      : [
          ...new Set(
            [
              ...folderPaths,
              ...items
                .filter(
                  (item): item is WorkspaceBrowseItem =>
                    item.source === "workspace" && inCollection(item, state.collection),
                )
                .map((item) => item.folder),
            ]
              .filter(
                (folder) =>
                  allowedFolder(folder) && folder.startsWith(baseFolder ? `${baseFolder}/` : ""),
              )
              .map((folder) => folder.slice(baseFolder ? baseFolder.length + 1 : 0).split("/")[0])
              .filter((name): name is string => Boolean(name))
              .map((name) => (baseFolder ? `${baseFolder}/${name}` : name)),
          ),
        ].sort((a, b) => a.localeCompare(b));
  return {
    items: pageItems,
    total: hits.length,
    workspaceCount: hits.filter((hit) => hit.item.source === "workspace").length,
    catalogCount: hits.filter((hit) => hit.item.source === "catalog").length,
    folders,
    page,
    pageCount,
  };
}

export function useBrowserItems(): {
  items: BrowseItem[];
  folders: readonly string[];
  indexReady: boolean;
  indexErrors: readonly string[];
  catalogLoaded: boolean;
  catalogLive: boolean;
  catalogError: string | null;
  catalogProblems: readonly string[];
  treeError: string | null;
} {
  const tree = useWorkspace((state) => state.tree);
  const treeError = useWorkspace((state) => state.treeError);
  const catalog = useCatalog();
  const index = useSyncExternalStore(indexStore.subscribe, indexStore.get);
  const query = useBrowserState().query;
  useEffect(() => {
    if (query.trim()) activateSearchIndex();
  }, [query]);
  const items = useMemo(
    () => buildBrowseItems(tree, catalog.entries.values(), index.entries),
    [tree, catalog.entries, index.entries],
  );
  return {
    items,
    folders: tree?.folders ?? [],
    indexReady: index.ready,
    indexErrors: index.errors,
    catalogLoaded: catalog.loaded,
    catalogLive: catalog.live,
    catalogError: catalog.error,
    catalogProblems: catalog.problems,
    treeError,
  };
}
