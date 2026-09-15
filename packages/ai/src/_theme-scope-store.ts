"use client";

/**
 * Shared, ref-counted `data-theme` observation (perf review §3.3).
 *
 * `code-block.tsx`'s `CodeBlockContent` and `_streamdown-i18n.ts`'s
 * `useReactiveCodePlugin` each used to instantiate their OWN
 * `MutationObserver` to notice a `data-theme` flip and re-derive the Shiki
 * theme — one observer PER rendered `CodeBlock`/`MessageResponse`/
 * `MarkdownView` instance, all typically watching the exact same ancestor. In
 * a message-dense conversation that is dozens of redundant observers doing
 * the same job.
 *
 * This module keeps exactly ONE `MutationObserver` per distinct scope
 * element (ref-counted: the observer is created on the first subscriber and
 * disconnected when the last one unsubscribes), and exposes it through
 * `useSyncExternalStore` so React's own re-render batching applies.
 */
import { useCallback, useSyncExternalStore } from "react";

/**
 * Nearest ancestor (inclusive) carrying `data-theme`, defaulting to `<html>`.
 * Lets a themed surface rendered inside a region-scoped
 * `<div data-theme="…">` (a supported `ThemeProvider`/decorator pattern —
 * see @.claude/rules/theming.md) resolve THAT region's tokens instead of
 * always the document root's.
 */
export function getThemeScope(el: Element | null): Element | null {
  return (
    el?.closest("[data-theme]") ??
    (typeof document !== "undefined" ? document.documentElement : null)
  );
}

interface ScopeEntry {
  observer: MutationObserver;
  revision: number;
  listeners: Set<() => void>;
}

const scopes = new Map<Element, ScopeEntry>();

function subscribe(scope: Element | null, onStoreChange: () => void): () => void {
  if (!scope) return () => {};

  let entry = scopes.get(scope);
  if (!entry) {
    // `entry` is assigned before `observer` fires, but TypeScript can't see
    // that through the closure — the callback only ever runs after this
    // function returns and `entry` has been set, and every existing
    // subscriber to this scope uses the SAME entry.
    const created: ScopeEntry = {
      listeners: new Set(),
      observer: new MutationObserver(() => {
        created.revision += 1;
        for (const listener of created.listeners) listener();
      }),
      revision: 0,
    };
    created.observer.observe(scope, { attributeFilter: ["data-theme"], attributes: true });
    scopes.set(scope, created);
    entry = created;
  }

  entry.listeners.add(onStoreChange);
  return () => {
    const current = scopes.get(scope);
    if (!current) return;
    current.listeners.delete(onStoreChange);
    if (current.listeners.size === 0) {
      current.observer.disconnect();
      scopes.delete(scope);
    }
  };
}

function getSnapshot(scope: Element | null): number {
  if (!scope) return 0;
  return scopes.get(scope)?.revision ?? 0;
}

const getServerSnapshot = () => 0;

/**
 * Subscribes to `data-theme` mutations on `el`'s closest `[data-theme]`
 * ancestor (default `<html>`) and returns a revision number that increments
 * on each mutation. Any number of callers scoped to the SAME ancestor share
 * one `MutationObserver`.
 */
export function useThemeScopeRevision(el: Element | null): number {
  const scope = getThemeScope(el);
  const subscribeToScope = useCallback(
    (onStoreChange: () => void) => subscribe(scope, onStoreChange),
    [scope],
  );
  const getScopeSnapshot = useCallback(() => getSnapshot(scope), [scope]);
  return useSyncExternalStore(subscribeToScope, getScopeSnapshot, getServerSnapshot);
}

/** Test-only: the number of scope elements currently under observation. */
export function _debugActiveThemeScopeCount(): number {
  return scopes.size;
}
