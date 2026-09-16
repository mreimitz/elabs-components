"use client";

/**
 * `useDashboardUrlState` (RM-083) — the seam between the store's live selection/variables and
 * a host's own URL/router state. Router-agnostic on purpose (D5): it touches no
 * `window`/`history`/router API itself, so it works the same wired to plain
 * `URLSearchParams`, nuqs or TanStack Router's search params — see `dashboard-sheet.stories.tsx`
 * ("URL state") for a `URLSearchParams` (`?d=`) example, and its module doc for the nuqs/
 * TanStack Router prose equivalents.
 */
import { useCallback, useMemo } from "react";

import type { SelectionValue } from "../core/selection";
import { decodeDashboardState, encodeDashboardState, type DecodedState } from "../core/url";
import { useDashboard, useDashboardActions } from "./use-dashboard";

/** `useDashboardUrlState`'s options. */
export interface UseDashboardUrlStateOptions {
  /** Included in `encoded` (`b=<id>`) when the current state came from a bookmark. */
  bookmarkId?: string;
  /** Included in `encoded` (`sh=<id>`), for a multi-sheet workbook. */
  sheetId?: string;
}

/** `useDashboardUrlState`'s return value. */
export interface UseDashboardUrlStateResult {
  /** The current selection + variables, `encodeDashboardState`-encoded. Memoised on the
   * selection snapshot and the variables map, so it is stable between unrelated renders. */
  encoded: string;
  /**
   * Decode `value` and apply its selection + variables to the store (each field replaced
   * wholesale, matching what `encoded` describes). A `null` decode (bad or oversized input)
   * is a silent no-op — never throws. Returns the decode result either way, so the caller can
   * still read `bookmarkId`/`sheetId` off it.
   */
  apply: (value: string) => DecodedState | null;
}

/**
 * Read the sheet's selection + variables as a compact, URL-safe string, and apply one back.
 * Wire `encoded` to your router's state (`setSearchParams({ d: encoded })`) and call `apply`
 * from wherever you read it back (on mount, on a popstate/router-change event) — this hook
 * itself never touches the URL.
 */
export function useDashboardUrlState(
  options: UseDashboardUrlStateOptions = {},
): UseDashboardUrlStateResult {
  const selection = useDashboard((state) => state.selection);
  const variables = useDashboard((state) => state.variables);
  const actions = useDashboardActions();
  const { bookmarkId, sheetId } = options;

  const encoded = useMemo(() => {
    const bySelectedField: Record<string, SelectionValue[]> = {};
    for (const [field, state] of Object.entries(selection.fields))
      if (state.values.length > 0) bySelectedField[field] = [...state.values];
    return encodeDashboardState({ selection: bySelectedField, variables, bookmarkId, sheetId });
  }, [selection, variables, bookmarkId, sheetId]);

  const apply = useCallback(
    (value: string) => {
      const decoded = decodeDashboardState(value);
      if (!decoded) return null;
      for (const [field, values] of Object.entries(decoded.selection))
        actions.select(field, values, { replace: true });
      for (const [name, varValue] of Object.entries(decoded.variables))
        actions.setVariable(name, varValue);
      return decoded;
    },
    [actions],
  );

  return { encoded, apply };
}
