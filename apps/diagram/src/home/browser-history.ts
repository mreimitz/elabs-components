/** Opened items only. A migrated path has unknown time; no date is invented for it. */
import { useSyncExternalStore } from "react";
import { createStore } from "../state/create-store";
import { workspaceStore } from "../workspace/workspace-store";

export type BrowseId = `workspace:${string}` | `catalog:${string}`;
export interface OpenedItem {
  id: BrowseId;
  openedAt: number | null;
}

const LIMIT = 100;
const KEY_PREFIX = "atlas.home.browser-history.v1:";

function validId(value: unknown): value is BrowseId {
  return (
    typeof value === "string" &&
    (value.startsWith("workspace:") || value.startsWith("catalog:")) &&
    value.split(":").slice(1).join(":").trim().length > 0
  );
}

/** Storage key is isolated by origin (localStorage) and by the app's workspace mount path. */
export function historyStorageKey(
  pathname = typeof location === "undefined" ? "/" : location.pathname,
): string {
  return `${KEY_PREFIX}${pathname}`;
}

/** Pure, defensive migration of the old newest-first workspace path list. */
export function parseOpenedHistory(
  raw: string | null,
  oldPaths: readonly string[] = [],
): OpenedItem[] {
  let parsed: unknown;
  try {
    parsed = raw === null ? null : JSON.parse(raw);
  } catch {
    parsed = null;
  }
  const source: unknown[] = Array.isArray(parsed) ? parsed : [];
  const migrated = oldPaths.map((path) => ({ id: `workspace:${path}`, openedAt: null }));
  const seen = new Set<string>();
  const out: OpenedItem[] = [];
  for (const candidate of [...source, ...migrated]) {
    if (candidate === null || typeof candidate !== "object") continue;
    const { id, openedAt } = candidate as Record<string, unknown>;
    if (!validId(id) || seen.has(id)) continue;
    if (
      openedAt !== null &&
      (typeof openedAt !== "number" || !Number.isFinite(openedAt) || openedAt < 0)
    )
      continue;
    seen.add(id);
    out.push({ id, openedAt: openedAt as number | null });
    if (out.length >= LIMIT) break;
  }
  return out;
}

function readHistory(): OpenedItem[] {
  try {
    return parseOpenedHistory(
      localStorage.getItem(historyStorageKey()),
      workspaceStore.get().recents,
    );
  } catch {
    return parseOpenedHistory(null, workspaceStore.get().recents);
  }
}

function saveHistory(items: readonly OpenedItem[]): void {
  try {
    localStorage.setItem(historyStorageKey(), JSON.stringify(items));
  } catch {
    // History remains usable in this tab when storage is blocked or full.
  }
}

export const browserHistoryStore = createStore<{ items: readonly OpenedItem[] }>({
  items: readHistory(),
});

export function useBrowserHistory(): readonly OpenedItem[] {
  return useSyncExternalStore(browserHistoryStore.subscribe, () => browserHistoryStore.get().items);
}

/** Call after a document load succeeds or a catalog detail route is actually opened. */
export function recordOpened(id: BrowseId, at = Date.now()): void {
  if (!validId(id) || !Number.isFinite(at) || at < 0) return;
  const items = [
    { id, openedAt: at },
    ...browserHistoryStore.get().items.filter((item) => item.id !== id),
  ].slice(0, LIMIT);
  browserHistoryStore.set({ items });
  saveHistory(items);
}

export function recentBrowseItems<T extends { id: BrowseId }>(
  items: readonly T[],
  opened: readonly OpenedItem[] = browserHistoryStore.get().items,
): { item: T; openedAt: number | null }[] {
  const byId = new Map(items.map((item) => [item.id, item]));
  return opened.flatMap(({ id, openedAt }) => {
    const item = byId.get(id);
    return item ? [{ item, openedAt }] : [];
  });
}
