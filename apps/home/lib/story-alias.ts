"use client";
/**
 * story-alias.ts — which story id to embed while a retitle is waiting for a Storybook deploy.
 *
 * A page retitled in the repo gets a new story id the moment it is renamed, but the deployed
 * Storybook keeps serving the old one until its next release. The generator records both
 * (content/generated/story-aliases.json); this asks the live Storybook which of the two it has.
 * Ids with no alias resolve synchronously and never trigger the lookup.
 *
 * In development the answer is not final: the debug profile's packaged Storybook copy
 * (.vscode/storybook-copy.mjs) can still be rebuilding when a page opens, and says so in an
 * `x-storybook-copy: rebuilding` header. While a page is missing stories, or cannot reach its
 * Storybook at all, the index is re-checked every few seconds, so the examples appear as soon
 * as the copy catches up instead of only after a reload.
 */
import { useEffect, useState } from "react";
import aliasJson from "../content/generated/story-aliases.json";

const ALIASES = aliasJson as Record<string, string>;
const DEV = process.env.NODE_ENV === "development";
const RECHECK_MS = 3000;

/**
 * Whether the site can reach its Storybook at all: `/storybook/` is a rewrite to another origin
 * (`next.config.ts`), and a site started against a Storybook that is not running answers 500 for
 * every story — in development, most often a `STORYBOOK_ORIGIN` whose server was stopped.
 */
export type StorybookReach = "unknown" | "ok" | "unreachable";

/** One reading of the live Storybook's index. */
export interface StoryIndex {
  /** Every story id it serves; `null` when it could not be read. */
  ids: Set<string> | null;
  reach: Exclude<StorybookReach, "unknown">;
  /** The local packaged copy is being rebuilt: `ids` are the previous build's. */
  rebuilding: boolean;
}

/**
 * The index, read once and shared; `watch()` re-reads it every `recheckMs` while anyone watches.
 * `load` is the request (injected for the unit test).
 */
export function createIndexSource(load: () => Promise<Response>, recheckMs: number) {
  let snapshot: StoryIndex | null = null;
  let inflight: Promise<StoryIndex> | null = null;
  let watchers = 0;
  let timer: ReturnType<typeof setInterval> | null = null;
  const listeners = new Set<() => void>();

  const read = async (): Promise<StoryIndex> => {
    try {
      const res = await load();
      if (!res.ok) return { ids: null, reach: "unreachable", rebuilding: false };
      const json = (await res.json()) as { entries?: Record<string, unknown> };
      return {
        ids: json?.entries ? new Set(Object.keys(json.entries)) : null,
        reach: "ok",
        rebuilding: res.headers.get("x-storybook-copy") === "rebuilding",
      };
    } catch {
      return { ids: null, reach: "unreachable", rebuilding: false };
    }
  };

  const refresh = (): Promise<StoryIndex> =>
    (inflight ??= read().then((next) => {
      snapshot = next;
      inflight = null;
      for (const listener of listeners) listener();
      return next;
    }));

  return {
    current: () => snapshot,
    get: () => (snapshot ? Promise.resolve(snapshot) : refresh()),
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },
    watch() {
      watchers += 1;
      timer ??= setInterval(() => void refresh(), recheckMs);
      return () => {
        watchers -= 1;
        if (watchers === 0 && timer) {
          clearInterval(timer);
          timer = null;
        }
      };
    },
  };
}

// `no-cache` revalidates rather than refetches: an unchanged index costs a 304.
const source = createIndexSource(
  () => fetch("/storybook/index.json", { cache: "no-cache" }),
  RECHECK_MS,
);

/** The latest index reading; `null` until the first answer. `enabled: false` never reads it. */
function useIndex(enabled = true): StoryIndex | null {
  const [index, setIndex] = useState<StoryIndex | null>(source.current());
  useEffect(() => {
    if (!enabled) return;
    const update = () => setIndex(source.current());
    const unsubscribe = source.subscribe(update);
    void source.get().then(update);
    return unsubscribe;
  }, [enabled]);
  return index;
}

/** In development, re-read the index while `behind` holds. */
function useCatchUp(behind: boolean) {
  useEffect(() => (DEV && behind ? source.watch() : undefined), [behind]);
}

/** `"unknown"` until the index answers; `"unreachable"` when `/storybook/` cannot be served. */
export function useStorybookReach(): StorybookReach {
  const reach = useIndex()?.reach ?? "unknown";
  useCatchUp(reach === "unreachable");
  return reach;
}

/** Whether the local packaged Storybook copy is being rebuilt right now (development only). */
export function useStorybookRebuilding(): boolean {
  return useIndex()?.rebuilding ?? false;
}

function has(ids: Set<string>, id: string): boolean {
  const alias = ALIASES[id];
  return ids.has(id) || (alias !== undefined && ids.has(alias));
}

/**
 * Which of `ids` the live Storybook does not have (a working tree ahead of the last release).
 * `null` until the index answers; an unreachable index reports nothing missing, so each frame
 * decides for itself.
 */
export function useMissingStories(ids: readonly string[]): string[] | null {
  const index = useIndex();
  const known = index?.ids;
  const missing = index ? (known ? ids.filter((id) => id && !has(known, id)) : []) : null;
  useCatchUp(Boolean(missing?.length));
  return missing;
}

/** The id to embed, or `null` for the moment an aliased id is still being resolved. */
export function useStoryId(id: string): string | null {
  const alias = ALIASES[id];
  const index = useIndex(alias !== undefined);
  if (!alias) return id;
  if (!index) return null;
  return index.ids && !index.ids.has(id) && index.ids.has(alias) ? alias : id;
}
