"use client";

/**
 * `useWorkbook` (RM-087, analysis §2.0, §7) — the multi-sheet container's store management.
 * One `DashboardStore` per sheet, created directly (`createDashboardStore`, the same
 * primitive `DashboardProvider` uses internally) and kept in a `Map` for the workbook's whole
 * lifetime, so a sheet's edits and undo history survive switching away and back — unlike a
 * `DashboardProvider` per sheet, which would tear its OWN internal store down on unmount.
 *
 * `applyCarriedSelection` is the seam `core/store.ts`'s own `CreateDashboardStoreOptions`
 * JSDoc names: a drill's `context.carry` (or a `sheetId`-bearing bookmark's `selection`)
 * applied to the TARGET sheet's store — global writes (no `fromTileId`), so they land as
 * plain filters regardless of that sheet's own interaction graph.
 */
import { useCallback, useMemo, useRef, useState } from "react";

import { compileCondition } from "../core/expression";
import { EMPTY_SELECTION, type SelectionValue } from "../core/selection";
import type { BookmarkSpec, DashboardSpec, VariableValue, WorkbookSpec } from "../core/spec";
import {
  createDashboardStore,
  type DashboardNavigateContext,
  type DashboardStore,
} from "../core/store";
import { normalizeDashboardSpec } from "../core/validate";

/** Applies a carried selection (a drill's `context.carry`, or a bookmark's own `selection`) to
 * `store`: one global `select` per field, `replace: true`. */
export function applyCarriedSelection(
  store: DashboardStore,
  carry: Record<string, SelectionValue[]>,
): void {
  const { actions } = store.getState();
  for (const [field, values] of Object.entries(carry))
    actions.select(field, values, { replace: true });
}

/** `shared` merged into `sheet`: the sheet's own `variables`/`bookmarks`/`library` entry wins
 * a name/id clash; a shared entry the sheet doesn't already have is appended. */
export function mergeSharedIntoSheet(
  sheet: DashboardSpec,
  shared: WorkbookSpec["shared"],
): DashboardSpec {
  if (!shared) return sheet;
  const merged: DashboardSpec = { ...sheet };
  if (shared.variables?.length) {
    const own = new Set((sheet.variables ?? []).map((v) => v.name));
    const extra = shared.variables.filter((v) => !own.has(v.name));
    if (extra.length) merged.variables = [...(sheet.variables ?? []), ...extra];
  }
  if (shared.bookmarks?.length) {
    const own = new Set((sheet.bookmarks ?? []).map((b) => b.id));
    const extra = shared.bookmarks.filter((b) => !own.has(b.id));
    if (extra.length) merged.bookmarks = [...(sheet.bookmarks ?? []), ...extra];
  }
  if (shared.library?.length) {
    const own = new Set((sheet.library ?? []).map((l) => l.id));
    const extra = shared.library.filter((l) => !own.has(l.id));
    if (extra.length) merged.library = [...(sheet.library ?? []), ...extra];
  }
  return merged;
}

/** A sheet's OWN declared variable defaults, for evaluating its `showCondition` before any
 * store exists for it (nav visibility is about workbook STRUCTURE, not live edits). */
function sheetDefaultContext(sheet: DashboardSpec) {
  const variables: Record<string, VariableValue> = {};
  for (const v of sheet.variables ?? []) variables[v.name] = v.default;
  return { variables, selection: EMPTY_SELECTION, mode: "view" as const };
}

/** Sheets whose `showCondition` holds (or is absent), in workbook order (analysis §2.0's
 * sheet-level show condition). An unparseable condition leaves the sheet visible, same
 * fail-open rule as a tile's `visibleWhen`. */
export function visibleWorkbookSheets(sheets: readonly DashboardSpec[]): DashboardSpec[] {
  return sheets.filter((sheet) => {
    if (!sheet.showCondition) return true;
    try {
      return compileCondition(sheet.showCondition)(sheetDefaultContext(sheet));
    } catch {
      return true;
    }
  });
}

export interface UseWorkbookOptions {
  workbook: WorkbookSpec;
  /** Controlled active sheet id. */
  activeSheetId?: string;
  /** Uncontrolled initial active sheet id. Default: the first visible sheet. */
  defaultActiveSheetId?: string;
  onActiveSheetChange?: (sheetId: string) => void;
}

/** A sheet switch that happened WITHOUT the user directly clicking/arrowing a tab (a drill's
 * `onNavigate`, or a `sheetId`-bearing bookmark) — `WorkbookNav` uses this to move focus and
 * announce the change (#429); a direct tab interaction never produces one, so it never gets a
 * duplicate announcement or an unexpected focus jump. `nonce` changes on every occurrence, even
 * a repeat switch to the same sheet, so a consumer's effect can key off it directly. */
export interface WorkbookProgrammaticSwitch {
  sheetId: string;
  nonce: number;
}

export interface UseWorkbookResult {
  activeSheetId: string;
  setActiveSheetId: (sheetId: string) => void;
  /** Sheets whose `showCondition` holds, in workbook order. */
  visibleSheets: DashboardSpec[];
  /** A sheet's store — created (with `shared` merged in) on first reference, then kept alive. */
  getStore: (sheetId: string) => DashboardStore;
  /** Every sheet id a store has been created for so far (in first-reference order). */
  visitedSheetIds: string[];
  /** `DashboardProvider`'s (or a hand-rolled context's) `onNavigate`: a plain navigate
   * switches sheets; a drill's `context.carry` is applied to the TARGET sheet first. */
  onNavigate: (sheetId: string, context?: DashboardNavigateContext) => void;
  /** Switches to `bookmark.sheetId` (default: the active sheet) and applies its `selection`/
   * `variables` there directly — works even for a sheet visited for the first time. */
  applyWorkbookBookmark: (bookmark: BookmarkSpec) => void;
  /** `true` while any visited sheet carries unsaved edits (`DashboardToolbar`'s dirty dot,
   * aggregated). */
  dirty: boolean;
  /** Set only when a drill or a `sheetId`-bearing bookmark actually changed the active sheet
   * (never for a direct tab click/arrow) — `null` until the first one happens. */
  programmaticSwitch: WorkbookProgrammaticSwitch | null;
}

export function useWorkbook(options: UseWorkbookOptions): UseWorkbookResult {
  const { workbook, activeSheetId: controlledActiveSheetId, onActiveSheetChange } = options;

  const visibleSheets = useMemo(() => visibleWorkbookSheets(workbook.sheets), [workbook.sheets]);
  const [uncontrolledActive, setUncontrolledActive] = useState(
    () => options.defaultActiveSheetId ?? visibleSheets[0]?.id ?? workbook.sheets[0]?.id ?? "",
  );
  const isControlled = controlledActiveSheetId !== undefined;
  const activeSheetId = isControlled ? (controlledActiveSheetId as string) : uncontrolledActive;

  const setActiveSheetId = useCallback(
    (sheetId: string) => {
      if (!isControlled) setUncontrolledActive(sheetId);
      onActiveSheetChange?.(sheetId);
    },
    [isControlled, onActiveSheetChange],
  );

  const specById = useMemo(() => {
    const map = new Map<string, DashboardSpec>();
    for (const sheet of workbook.sheets)
      map.set(sheet.id, mergeSharedIntoSheet(sheet, workbook.shared));
    return map;
  }, [workbook]);

  const storesRef = useRef(new Map<string, DashboardStore>());
  const [visitedSheetIds, setVisitedSheetIds] = useState<string[]>([]);
  const [dirtyMap, setDirtyMap] = useState<Record<string, boolean>>({});
  const [programmaticSwitch, setProgrammaticSwitch] = useState<WorkbookProgrammaticSwitch | null>(
    null,
  );
  const switchNonceRef = useRef(0);
  // A drill/bookmark switch to a sheet id equal to the CURRENT active one (e.g. a bookmark whose
  // own sheet is already showing) applies its selection but never counts as a "switch" — nothing
  // to announce or refocus.
  const markProgrammaticSwitch = useCallback((sheetId: string) => {
    switchNonceRef.current += 1;
    setProgrammaticSwitch({ sheetId, nonce: switchNonceRef.current });
  }, []);

  // `onNavigate` closes over `getStore`, and every store's OWN `onNavigate` option (below)
  // closes back over this — a ref breaks the cycle without a stale closure.
  const onNavigateRef = useRef<(sheetId: string, context?: DashboardNavigateContext) => void>(
    () => {},
  );

  const getStore = useCallback(
    (sheetId: string): DashboardStore => {
      const existing = storesRef.current.get(sheetId);
      if (existing) return existing;
      const spec = specById.get(sheetId);
      if (!spec) throw new Error(`DashboardWorkbook: no sheet “${sheetId}”.`);
      const store = createDashboardStore({
        spec: normalizeDashboardSpec(spec).spec,
        sheets: workbook.sheets.map((s) => s.id),
        onNavigate: (target, context) => onNavigateRef.current(target, context),
      });
      storesRef.current.set(sheetId, store);
      store.subscribe(
        (state) => state.dirty,
        (dirty) =>
          setDirtyMap((prev) => (prev[sheetId] === dirty ? prev : { ...prev, [sheetId]: dirty })),
      );
      setVisitedSheetIds((prev) => (prev.includes(sheetId) ? prev : [...prev, sheetId]));
      return store;
    },
    [specById, workbook.sheets],
  );

  onNavigateRef.current = (sheetId, context) => {
    const isSwitch = sheetId !== activeSheetId;
    const store = getStore(sheetId);
    if (context?.carry) applyCarriedSelection(store, context.carry);
    setActiveSheetId(sheetId);
    if (isSwitch) markProgrammaticSwitch(sheetId);
  };

  const applyWorkbookBookmark = useCallback(
    (bookmark: BookmarkSpec) => {
      const targetId = bookmark.sheetId ?? activeSheetId;
      const isSwitch = targetId !== activeSheetId;
      const store = getStore(targetId);
      setActiveSheetId(targetId);
      const { actions } = store.getState();
      for (const [field, values] of Object.entries(bookmark.selection))
        actions.select(field, values, { replace: true });
      for (const [name, value] of Object.entries(bookmark.variables ?? {}))
        actions.setVariable(name, value);
      if (isSwitch) markProgrammaticSwitch(targetId);
    },
    [activeSheetId, getStore, setActiveSheetId, markProgrammaticSwitch],
  );

  const dirty = useMemo(() => Object.values(dirtyMap).some(Boolean), [dirtyMap]);

  return {
    activeSheetId,
    setActiveSheetId,
    visibleSheets,
    getStore,
    visitedSheetIds,
    onNavigate: (sheetId, context) => onNavigateRef.current(sheetId, context),
    applyWorkbookBookmark,
    dirty,
    programmaticSwitch,
  };
}
