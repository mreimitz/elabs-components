/**
 * Sidebar search (maintainer request 2026-09-28: "it should search and filter the entire
 * workspace"), by NAMES AND CONTENTS — a diagram is found by its title, its file name or its
 * folder path, and also by what is drawn inside it: box names, ids, icons, descriptions.
 *
 * Built from the workspace tree plus one read per file, cached by mtime so a rebuild after a
 * change reads only what changed (the shape DG-23's old `home/search.ts` planned — see
 * `roadmap/DG-23-home.md` — reused here for the sidebar instead). Every file is parsed
 * TOLERANTLY with the `yaml` library: `buildEntry` never throws, whatever the dialect (the v0
 * zones/nodes shape, or a v1 file with `ref:`/`component:`) — a box is anything, anywhere in
 * the document, carrying an `id`, `title`, `subtitle`, `description`, `icon`, `ref` or
 * `component` string, found by walking every object generically rather than assuming a
 * particular schema. React-free: `workspace-tree.tsx` reads `indexStore` with
 * `useSyncExternalStore` and starts it with `activateSearchIndex` (`search-store.ts`).
 */
import { parseDocument } from "yaml";
import { createStore } from "../state/create-store";
import { readFile, type WorkspaceFile, type WorkspaceTree } from "./client";
import { workspaceStore } from "./workspace-store";

// ── One file's index entry ───────────────────────────────────────────────────────────────

/** Any object in the document naming a box: a node, a zone, or (v1) a `ref:`/`component:`. */
export interface IndexedBox {
  id?: string;
  title?: string;
  subtitle?: string;
  description?: string;
  icon?: string;
  ref?: string;
  component?: string;
}

export interface IndexEntry {
  path: string;
  /** `landscape.yaml`. */
  fileName: string;
  /** `landscape.yaml` without its extension. */
  stem: string;
  /** Workspace-relative; `""` is the root. */
  folder: string;
  /** The YAML `title:`, else the file name. */
  title: string;
  /** The YAML `description:`, else `""`. */
  description: string;
  mtime: number;
  boxes: IndexedBox[];
}

const BOX_KEYS = ["id", "title", "subtitle", "description", "icon", "ref", "component"] as const;

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() !== "" ? value : undefined;
}

function pickBox(obj: Record<string, unknown>): IndexedBox | undefined {
  const box: IndexedBox = {};
  for (const key of BOX_KEYS) {
    const value = asString(obj[key]);
    if (value !== undefined) box[key] = value;
  }
  return Object.keys(box).length > 0 ? box : undefined;
}

/**
 * Every box anywhere under `value` (any depth, any key name — `zones`, `nodes`, `children`,
 * or whatever a future dialect calls its list). `depth` starts at 1 so the root's own fields
 * (handled separately by the caller) are never picked up as a box.
 */
function walkBoxes(value: unknown, depth: number, boxes: IndexedBox[]): void {
  if (Array.isArray(value)) {
    for (const item of value) walkBoxes(item, depth, boxes);
    return;
  }
  if (value === null || typeof value !== "object") return;
  const obj = value as Record<string, unknown>;
  if (depth > 0) {
    const box = pickBox(obj);
    if (box) boxes.push(box);
  }
  for (const [key, child] of Object.entries(obj)) {
    if (depth === 0 && (key === "title" || key === "description")) continue;
    walkBoxes(child, depth + 1, boxes);
  }
}

function baseName(path: string): string {
  return path.split("/").pop() ?? path;
}

function folderOf(path: string): string {
  const slash = path.lastIndexOf("/");
  return slash < 0 ? "" : path.slice(0, slash);
}

function stemOf(name: string): string {
  return name.replace(/\.ya?ml$/i, "");
}

/** One file's entry from its text. Never throws: a YAML error leaves title/name/folder only. */
export function buildEntry(file: WorkspaceFile, text: string): IndexEntry {
  const fileName = baseName(file.path);
  const boxes: IndexedBox[] = [];
  let description = "";
  try {
    const parsed: unknown = parseDocument(text).toJS();
    if (parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)) {
      const root = parsed as Record<string, unknown>;
      description = asString(root.description) ?? "";
      for (const [key, value] of Object.entries(root)) {
        if (key === "title" || key === "description") continue;
        walkBoxes(value, 1, boxes);
      }
    }
  } catch {
    // Tolerant by design: any dialect, any mistake — the tree's own fields still search.
  }
  return {
    path: file.path,
    fileName,
    stem: stemOf(fileName),
    folder: folderOf(file.path),
    title: file.title?.trim() || stemOf(fileName),
    description,
    mtime: file.mtime,
    boxes,
  };
}

// ── The whole index, cached by mtime ─────────────────────────────────────────────────────

export type ReadText = (path: string) => Promise<{ text: string; mtime: number }>;

const TRASH_PREFIX = "_trash/";
const isTrash = (path: string) => path === "_trash" || path.startsWith(TRASH_PREFIX);

const cache = new Map<string, IndexEntry>();

/** The whole index; unchanged files (same mtime) come from the cache. `_trash/` is skipped. */
export async function buildIndex(tree: WorkspaceTree, read: ReadText): Promise<IndexEntry[]> {
  const files = tree.files.filter((file) => !isTrash(file.path));
  const live = new Set(files.map((file) => file.path));
  for (const path of cache.keys()) if (!live.has(path)) cache.delete(path);
  return Promise.all(
    files.map(async (file) => {
      const hit = cache.get(file.path);
      if (hit && hit.mtime === file.mtime) return hit;
      let text = "";
      let readOk = true;
      try {
        text = (await read(file.path)).text;
      } catch {
        // Unreadable (gone between /tree and the read, or a transient error): a name-only entry
        // for this build, and NOT cached — the next rebuild retries the read rather than
        // repeating this failure until the file's mtime happens to change.
        readOk = false;
      }
      const entry = buildEntry(file, text);
      if (readOk) cache.set(file.path, entry);
      return entry;
    }),
  );
}

// ── Matching and ranking ─────────────────────────────────────────────────────────────────

/** Case- and diacritic-folded. */
export function normalizeText(value: string): string {
  return value.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
}

/** The query, folded and split on whitespace — every word must match somewhere (AND). */
export function queryWords(query: string): string[] {
  return normalizeText(query).trim().split(/\s+/).filter(Boolean);
}

export type MatchField =
  | "title"
  | "fileName"
  | "folder"
  | "id"
  | "ref"
  | "boxTitle"
  | "subtitle"
  | "icon"
  | "description";

/**
 * The old Home search's weights (`roadmap/DG-23-home.md`: title exact 1, prefix .95,
 * contains .9, id exact .8, id contains .7, node title .6, icon .5, description .3),
 * reused. `fileName` and `folder` sit at the title tier — the maintainer's answer is "found
 * by its title OR file name". `subtitle` has no weight in the original table: .4, a rung
 * between a box's own title and its description. `ref` (a v1 node's `ref:`/`component:`
 * target — DG-26) sits at the id tier: it is the same kind of machine name.
 */
const NAME_TIER = { exact: 1, prefix: 0.95, contains: 0.9 };
const ID_TIER = { exact: 0.8, contains: 0.7 };
const BOX_TITLE_WEIGHT = 0.6;
const SUBTITLE_WEIGHT = 0.4;
const ICON_WEIGHT = 0.5;
const DESCRIPTION_WEIGHT = 0.3;

export interface MatchRange {
  start: number;
  end: number;
}

export interface FieldMatch {
  field: MatchField;
  text: string;
  /** Where the query's words sit in `text` (original, un-normalized indices), merged. */
  ranges: MatchRange[];
}

export interface EntryMatch {
  /** The row's own title already satisfies the query: no second line needed. */
  titleMatch: boolean;
  /** Where the query's words sit in the row's own title, when any do (even a partial cover,
   * shown alongside `reason`) — `TreeItem` highlights the title with these. */
  titleRanges?: MatchRange[];
  /** The best other field to show as "what matched", when `titleMatch` is false. */
  reason?: FieldMatch;
}

/** Every occurrence of the (already-normalized) `word` in `haystack`, as original indices. */
function findRanges(haystack: string, word: string): MatchRange[] {
  let normalized = "";
  const map: number[] = [];
  for (let i = 0; i < haystack.length; i += 1) {
    for (const ch of normalizeText(haystack[i]!)) {
      normalized += ch;
      map.push(i);
    }
  }
  const ranges: MatchRange[] = [];
  let from = 0;
  for (;;) {
    const at = normalized.indexOf(word, from);
    if (at < 0) break;
    const start = map[at] ?? 0;
    const end = (map[at + word.length - 1] ?? start) + 1;
    ranges.push({ start, end });
    from = at + Math.max(word.length, 1);
  }
  return ranges;
}

function mergeRanges(ranges: MatchRange[]): MatchRange[] {
  if (ranges.length <= 1) return ranges;
  const sorted = [...ranges].sort((a, b) => a.start - b.start);
  const merged: MatchRange[] = [sorted[0]!];
  for (const range of sorted.slice(1)) {
    const last = merged[merged.length - 1]!;
    if (range.start <= last.end) last.end = Math.max(last.end, range.end);
    else merged.push(range);
  }
  return merged;
}

interface Candidate {
  field: MatchField;
  text: string;
  /** Which of `entry.boxes` this came from — lets `matchEntry` prefer a box's own title over
   * its id when both match. */
  boxIndex?: number;
}

interface FieldHit extends Candidate {
  weight: number;
  words: Set<number>;
  ranges: MatchRange[];
}

function weightOf(field: MatchField, normalized: string, word: string): number {
  switch (field) {
    case "title":
    case "fileName":
    case "folder":
      return normalized === word
        ? NAME_TIER.exact
        : normalized.startsWith(word)
          ? NAME_TIER.prefix
          : normalized.includes(word)
            ? NAME_TIER.contains
            : 0;
    case "id":
    case "ref":
      return normalized === word ? ID_TIER.exact : normalized.includes(word) ? ID_TIER.contains : 0;
    case "boxTitle":
      return normalized.includes(word) ? BOX_TITLE_WEIGHT : 0;
    case "subtitle":
      return normalized.includes(word) ? SUBTITLE_WEIGHT : 0;
    case "icon":
      return normalized.includes(word) ? ICON_WEIGHT : 0;
    case "description":
      return normalized.includes(word) ? DESCRIPTION_WEIGHT : 0;
  }
}

function scoreField(candidate: Candidate, words: readonly string[]): FieldHit | undefined {
  const { field, text, boxIndex } = candidate;
  const normalized = normalizeText(text);
  let weight = 0;
  const words_ = new Set<number>();
  const ranges: MatchRange[] = [];
  words.forEach((word, index) => {
    const hit = weightOf(field, normalized, word);
    if (hit <= 0) return;
    words_.add(index);
    weight = Math.max(weight, hit);
    ranges.push(...findRanges(text, word));
  });
  if (words_.size === 0) return undefined;
  return { field, text, boxIndex, weight, words: words_, ranges: mergeRanges(ranges) };
}

/** Every other searchable string on `entry`: its file name (with extension), its full path (so
 * a folder-and-file query like "examples/lakehouse" or the header breadcrumb's own text also
 * finds it), its ancestor folders' names, and each box's id, ref/component, title, subtitle,
 * icon and description — each tagged with the box it came from (`boxIndex`), so a box's id and
 * its own title are never confused for two different boxes' matches. */
function candidatesOf(entry: IndexEntry, ancestorFolders: readonly string[]): Candidate[] {
  const list: Candidate[] = [{ field: "fileName", text: entry.fileName }];
  // Root-level files: `entry.path` already equals `entry.fileName`, so a second candidate
  // would only duplicate the one above.
  if (entry.folder !== "") list.push({ field: "fileName", text: entry.path });
  list.push(...ancestorFolders.map((name) => ({ field: "folder" as const, text: name })));
  if (entry.description) list.push({ field: "description", text: entry.description });
  entry.boxes.forEach((box, boxIndex) => {
    // id, ref and component are separate candidates (not `id ?? ref ?? component`): a v1
    // reference node (DG-26) always carries an id ALONGSIDE its `ref:`, and the maintainer's
    // "found by its icon" promise must keep working once catalog refs replace `icon:` — so the
    // ref itself has to stay searchable even though the same box also has an id.
    if (box.id) list.push({ field: "id", text: box.id, boxIndex });
    if (box.ref) list.push({ field: "ref", text: box.ref, boxIndex });
    if (box.component) list.push({ field: "ref", text: box.component, boxIndex });
    if (box.title) list.push({ field: "boxTitle", text: box.title, boxIndex });
    if (box.subtitle) list.push({ field: "subtitle", text: box.subtitle, boxIndex });
    if (box.icon) list.push({ field: "icon", text: box.icon, boxIndex });
    if (box.description) list.push({ field: "description", text: box.description, boxIndex });
  });
  return list;
}

/** How many of `hit`'s words are NOT already covered by the row's own title — the words that
 * actually explain why a row with no title match showed up. */
function uncoveredByTitle(hit: FieldHit, titleWords: ReadonlySet<number>): number {
  let count = 0;
  hit.words.forEach((word) => {
    if (!titleWords.has(word)) count += 1;
  });
  return count;
}

/**
 * Does `entry` match every word in `words`? (`ancestorFolders`: the names of every folder from
 * its own parent up to the workspace root — a folder whose name alone covers every word makes
 * every file under it match, the same as a title or file-name match would.) `null`: no match,
 * some word matches nowhere. Otherwise: `titleMatch` (no second line needed) or `reason`, the
 * single best other field to show ("Box: Snowflake"), picked by how many words it covers that
 * the title itself does NOT already show, then by how many words it covers, then by weight —
 * so a two-word query is explained by the word the title does not already reveal, and a
 * box's own title is shown over its id when both match it.
 */
export function matchEntry(
  entry: IndexEntry,
  ancestorFolders: readonly string[],
  words: readonly string[],
): EntryMatch | null {
  if (words.length === 0) return { titleMatch: false };
  const titleHit = scoreField({ field: "title", text: entry.title }, words);
  const covered = new Set<number>(titleHit?.words ?? []);
  const hits: FieldHit[] = [];
  for (const candidate of candidatesOf(entry, ancestorFolders)) {
    const hit = scoreField(candidate, words);
    if (!hit) continue;
    hits.push(hit);
    hit.words.forEach((word) => covered.add(word));
  }
  if (covered.size < words.length) return null;
  const titleRanges = titleHit?.ranges;
  if (titleHit && titleHit.words.size === words.length) return { titleMatch: true, titleRanges };
  if (hits.length === 0) return { titleMatch: false, titleRanges };
  const titleWords = titleHit?.words ?? new Set<number>();
  hits.sort(
    (a, b) =>
      uncoveredByTitle(b, titleWords) - uncoveredByTitle(a, titleWords) ||
      b.words.size - a.words.size ||
      b.weight - a.weight,
  );
  let best = hits[0]!;
  if (best.field === "id" || best.field === "ref") {
    const nicer = hits.find(
      (hit) =>
        hit.boxIndex === best.boxIndex &&
        (hit.field === "boxTitle" || hit.field === "subtitle") &&
        hit.words.size >= best.words.size,
    );
    if (nicer) best = nicer;
  }
  return {
    titleMatch: false,
    titleRanges,
    reason: { field: best.field, text: best.text, ranges: best.ranges },
  };
}

// ── The index for the live workspace tree ────────────────────────────────────────────────

export const indexStore = createStore<{ entries: readonly IndexEntry[]; ready: boolean }>({
  entries: [],
  ready: false,
});

let building: WorkspaceTree | null = null;

/** Rebuild for `tree` (the latest call wins). */
export async function refreshSearchIndex(tree: WorkspaceTree): Promise<void> {
  building = tree;
  const entries = await buildIndex(tree, readFile);
  if (building === tree) indexStore.set({ entries, ready: true });
}

let active = false;
let lastTree: WorkspaceTree | null = null;

function refreshIfNeeded(): void {
  const tree = workspaceStore.get().tree;
  if (!active || !tree || tree === lastTree) return;
  lastTree = tree;
  void refreshSearchIndex(tree);
}

// Live reload replaces the workspace store's `tree` on every disk event (`live-reload.ts`); a
// module-level subscription (not a component effect keyed on the tree) keeps the index fresh
// for as long as `activateSearchIndex` has been called at least once.
workspaceStore.subscribe(refreshIfNeeded);

/**
 * Start indexing (idempotent, one-shot): `search-store.ts` calls this the moment a query first
 * becomes non-empty or the "/" shortcut fires, so a session that never searches never reads a
 * single workspace file. `indexStore` is a plain vanilla store; the shell reads it with
 * `useSyncExternalStore` (`workspace-tree.tsx`) — this module stays React-free.
 */
export function activateSearchIndex(): void {
  if (active) return;
  active = true;
  refreshIfNeeded();
}
