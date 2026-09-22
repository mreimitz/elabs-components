"use client";

/**
 * `DashboardSelectionBar` (RM-076, analysis §2.0/§2.3) — the selections tool, smart search'
 * companion row: Clear all, Step back, Step forward, then one chip per selected or locked
 * field, then a Bookmarks menu. Analysis §2.3 calls this "the single most-copied BI
 * interaction"; §2.0 is the maintainer-tenant reference this composes.
 *
 * Drives everything through RM-071's store/selection slice (`useDashboard`/
 * `useDashboardActions`) — it never touches a `SelectionDriver` directly except for the
 * optional `driver` prop below.
 *
 * `canBack`/`canForward` gap: `DashboardState`/`DashboardActions` (`core/store.ts`) mirror
 * `driver.getSnapshot()` but never `driver.canBack()`/`canForward()` — there is no store
 * field to read them from. Without an explicit `driver` prop (the same instance passed to
 * `DashboardProvider`), Step back/forward stay enabled and rely on `back()`/`forward()`'s
 * own safe no-op at the boundary; see the RM-076 result file for the suggested store fix.
 */
import { useEffect, useState, type HTMLAttributes } from "react";
import {
  Badge,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Toolbar,
  ToolbarButton,
  ToolbarSeparator,
  ToolbarSlot,
  cn,
} from "@elabs-ai/components-ui";
import { Bookmark, ChevronLeft, ChevronRight, ListFilter, Lock, Unlock, X } from "lucide-react";

import type { SelectionDriver, SelectionSnapshot } from "../core/selection";
import type { VariableValue } from "../core/spec";
import { useDashboard, useDashboardActions } from "../dashboard-sheet";

/** Strings `DashboardSelectionBar` renders. Pass your own via the `labels` prop to localise. */
export interface SelectionBarLabels {
  ariaLabel: string;
  clearAll: string;
  back: string;
  forward: string;
  bookmarks: string;
  saveBookmark: string;
  lockField: (field: string) => string;
  unlockField: (field: string) => string;
  clearField: (field: string) => string;
  locked: string;
  more: (n: number) => string;
  cleared: string;
  fieldSelected: (field: string, summary: string) => string;
  /** Shown in place of chips while nothing is selected. */
  noSelections: string;
}

/** The labels the bar uses when a host passes none. */
export const DEFAULT_SELECTION_BAR_LABELS: SelectionBarLabels = {
  ariaLabel: "Selections",
  clearAll: "Clear all",
  back: "Step back",
  forward: "Step forward",
  bookmarks: "Bookmarks",
  saveBookmark: "Save bookmark…",
  lockField: (field) => `Lock ${field}`,
  unlockField: (field) => `Unlock ${field}`,
  clearField: (field) => `Clear ${field}`,
  locked: "Locked",
  more: (n) => `+${n}`,
  cleared: "All selections cleared",
  fieldSelected: (field, summary) => `${field} selected: ${summary}`,
  noSelections: "No selections",
};

/** The slice of `SelectionDriver` the bar needs to show correct Step back/forward state. */
export type SelectionBarDriver = Pick<SelectionDriver, "canBack" | "canForward" | "subscribe">;

export interface DashboardSelectionBarProps extends Omit<HTMLAttributes<HTMLDivElement>, "dir"> {
  /** Show the Bookmarks menu. Default `true`. */
  bookmarks?: boolean;
  /**
   * Called when "Save bookmark…" is chosen, with the current selection and variables. The
   * bar never mutates `spec.bookmarks` itself — persistence is the host's (D5).
   */
  onSaveBookmark?: (
    snapshot: SelectionSnapshot,
    variables: Readonly<Record<string, VariableValue>>,
  ) => void;
  /** The same driver instance passed to `DashboardProvider` — see the module doc. */
  driver?: SelectionBarDriver;
  labels?: Partial<SelectionBarLabels>;
}

/** Tracks `driver.canBack()`/`canForward()`; both `true` (a safe default) without a driver. */
function useStepFlags(driver: SelectionBarDriver | undefined) {
  const [flags, setFlags] = useState(() => ({
    canBack: driver?.canBack() ?? true,
    canForward: driver?.canForward() ?? true,
  }));
  useEffect(() => {
    if (!driver) {
      setFlags({ canBack: true, canForward: true });
      return;
    }
    const sync = () => setFlags({ canBack: driver.canBack(), canForward: driver.canForward() });
    sync();
    return driver.subscribe(sync);
  }, [driver]);
  return flags;
}

/** A chip's visible summary: up to two values, then `+n`, or the locked word when empty. */
function chipSummary(values: readonly (string | number)[], labels: SelectionBarLabels): string {
  if (values.length === 0) return labels.locked;
  const shown = values.slice(0, 2).map(String);
  const extra = values.length - shown.length;
  return extra > 0 ? `${shown.join(", ")}, ${labels.more(extra)}` : shown.join(", ");
}

/**
 * The selections tool row: Clear all, Step back/forward, one chip per selected or locked
 * field, then Bookmarks. Chips reuse `Badge variant="secondary"` for the pill (no dedicated
 * `"selection"` variant — `badge.tsx` is outside this change's write set; see the result
 * file) inside a real `ToolbarButton`, so the chip stays keyboard-operable.
 */
export function DashboardSelectionBar({
  bookmarks = true,
  onSaveBookmark,
  driver,
  labels,
  className,
  ...props
}: DashboardSelectionBarProps) {
  const mergedLabels = { ...DEFAULT_SELECTION_BAR_LABELS, ...labels };
  const selection = useDashboard((s) => s.selection);
  const bookmarkList = useDashboard((s) => s.spec.bookmarks) ?? [];
  const variables = useDashboard((s) => s.variables);
  const actions = useDashboardActions();
  const { canBack, canForward } = useStepFlags(driver);

  const [liveMessage, setLiveMessage] = useState("");
  // The live region only announces a CHANGE, so the previous snapshot is state (not a
  // ref): comparing against it must itself trigger a render when it moves.
  const [previousSelection, setPreviousSelection] = useState(selection);
  useEffect(() => {
    if (selection === previousSelection) return;
    if (selection.count() === 0 && previousSelection.count() > 0) {
      setLiveMessage(mergedLabels.cleared);
    } else {
      for (const [field, state] of Object.entries(selection.fields)) {
        const prior = previousSelection.fields[field];
        const changed = !prior || prior.values.join("\u0000") !== state.values.join("\u0000");
        if (changed && state.values.length > 0) {
          setLiveMessage(
            mergedLabels.fieldSelected(field, chipSummary(state.values, mergedLabels)),
          );
          break;
        }
      }
    }
    setPreviousSelection(selection);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mergedLabels is a fresh object every render
  }, [selection, previousSelection]);

  const chips = Object.entries(selection.fields).filter(
    ([, state]) => state.locked || state.values.length > 0,
  );
  // "Save bookmark…" is a dead control with no `onSaveBookmark` (D5: the bar never persists on
  // its own) — omit it, and hide the whole trigger too when that would leave the menu empty.
  const showBookmarksMenu = bookmarks && (bookmarkList.length > 0 || Boolean(onSaveBookmark));

  return (
    <Toolbar
      aria-label={mergedLabels.ariaLabel}
      data-slot="dashboard-selection-bar"
      data-empty={chips.length === 0 ? "" : undefined}
      className={cn(
        "min-h-10 flex-wrap gap-1.5 border-b border-border bg-background px-2 py-1",
        className,
      )}
      {...props}
    >
      <ListFilter aria-hidden="true" className="ms-1 size-4 shrink-0 text-muted-foreground" />
      {chips.length === 0 ? (
        <span
          data-slot="dashboard-selection-bar-empty"
          className="text-caption text-muted-foreground"
        >
          {mergedLabels.noSelections}
        </span>
      ) : null}
      {chips.length > 0 ? <ToolbarSeparator /> : null}
      {chips.map(([field, state]) => (
        <DropdownMenu key={field}>
          <span className="inline-flex items-center gap-0.5 animate-in fade-in zoom-in-95 duration-fast ease-entrance motion-reduce:animate-none">
            {/*
             * `ToolbarSlot` (`asChild`) hands the roving-tabindex wiring to the trigger it
             * wraps — the toolbar.tsx-documented escape hatch for a `DropdownMenu` trigger
             * inside a `Toolbar`. Composing `DropdownMenuTrigger asChild` directly around
             * `ToolbarButton` (two independent Radix primitives, neither expecting the
             * other's roving-focus wiring) silently ate the trigger's open behaviour.
             */}
            <DropdownMenuTrigger asChild>
              <ToolbarSlot asChild>
                <Button
                  variant="ghost"
                  className="h-auto gap-0 rounded-full p-0 hover:bg-transparent"
                >
                  <Badge variant="secondary" className="gap-1.5 rounded-full px-2.5 py-1">
                    {state.locked ? <Lock aria-hidden="true" className="size-3" /> : null}
                    <span className="font-medium">{field}</span>
                    <span className="text-muted-foreground">
                      {chipSummary(state.values, mergedLabels)}
                    </span>
                  </Badge>
                </Button>
              </ToolbarSlot>
            </DropdownMenuTrigger>
            <ToolbarButton
              variant="ghost"
              size="icon-sm"
              className="size-5 rounded-full"
              aria-label={mergedLabels.clearField(field)}
              disabled={state.locked}
              onClick={() => actions.clearSelection(field)}
            >
              <X aria-hidden="true" className="size-3" />
            </ToolbarButton>
          </span>
          <DropdownMenuContent align="start">
            <DropdownMenuItem onSelect={() => actions.lock(field, !state.locked)}>
              {state.locked ? <Unlock aria-hidden="true" /> : <Lock aria-hidden="true" />}
              {state.locked ? mergedLabels.unlockField(field) : mergedLabels.lockField(field)}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ))}
      <span aria-hidden="true" className="flex-1" />
      <ToolbarButton
        variant="ghost"
        size="sm"
        disabled={selection.count() === 0}
        onClick={() => actions.clearSelection()}
      >
        {mergedLabels.clearAll}
      </ToolbarButton>
      <ToolbarSeparator />
      <ToolbarButton
        variant="ghost"
        size="icon-sm"
        aria-label={mergedLabels.back}
        disabled={!canBack}
        onClick={() => actions.back()}
      >
        <ChevronLeft aria-hidden="true" />
      </ToolbarButton>
      <ToolbarButton
        variant="ghost"
        size="icon-sm"
        aria-label={mergedLabels.forward}
        disabled={!canForward}
        onClick={() => actions.forward()}
      >
        <ChevronRight aria-hidden="true" />
      </ToolbarButton>
      {showBookmarksMenu ? (
        <>
          <ToolbarSeparator />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <ToolbarSlot asChild>
                <Button variant="ghost" size="sm">
                  <Bookmark aria-hidden="true" />
                  {mergedLabels.bookmarks}
                </Button>
              </ToolbarSlot>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {bookmarkList.length > 0 ? (
                <>
                  <DropdownMenuLabel>{mergedLabels.bookmarks}</DropdownMenuLabel>
                  {bookmarkList.map((bookmark) => (
                    <DropdownMenuItem
                      key={bookmark.id}
                      onSelect={() => actions.applyBookmark(bookmark.id)}
                    >
                      {bookmark.label}
                    </DropdownMenuItem>
                  ))}
                  {onSaveBookmark ? <DropdownMenuSeparator /> : null}
                </>
              ) : null}
              {onSaveBookmark ? (
                <DropdownMenuItem onSelect={() => onSaveBookmark(selection, variables)}>
                  {mergedLabels.saveBookmark}
                </DropdownMenuItem>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
        </>
      ) : null}
      <span role="status" aria-live="polite" className="sr-only">
        {liveMessage}
      </span>
    </Toolbar>
  );
}
