"use client";

/**
 * `filter` tile (RM-076, analysis §4 R13/R19/R23) — a searchable value list, or a
 * hierarchical tree, bound to the sheet's selection fields and drawn with the tri-state
 * selected/associated/excluded encoding.
 *
 * Two bodies share one header, one search box and one selection session:
 * - **flat** (`values`): the field's known domain as a `ui/Command` list — the original tile.
 * - **tree** (`levels` or `parentChild` over `rows`): a `ui/Tree` of 2–6 levels or a
 *   self-referential parent-child table (`tiles/filter-tree.ts`), the shape of the
 *   hierarchical filter pane BI users know: expand/collapse all, default expand level,
 *   leaf-only selection, select-with-children, counts on parents, a dense row option.
 *
 * Every body reads per-value STATE from the live `selection` snapshot (any driver, local or
 * a host engine) and writes through `emit.select` (the one path the interaction graph
 * routes). `confirm: true` turns clicks into a pending session — a Confirm/Cancel bar
 * appears, and nothing reaches the driver until Confirm — the native filter-pane behaviour.
 *
 * At the `xs` density tier the tile collapses to a bar (its label plus the selection
 * summary); clicking it opens the full panel in a popover, search always visible.
 *
 * `dashboard/` may only import `charts`/`ui`/`tokens`/`icons` (`.claude/rules/dashboard.md`),
 * so this composes `ui/Command`, `ui/Tree`, `ui/Badge` and `ui/Popover` directly. The
 * per-row check mark is a plain `aria-hidden` glyph, not `ui/Checkbox` (nested interactive
 * inside `role="option"`/`treeitem` fails axe); the row is the one interactive target and
 * its accessible name carries the state.
 *
 * `content.values`/`content.rows` are the field's known domain — there is no way to ask a
 * `SelectionDriver` to enumerate values (D5: only the host that owns the data touches
 * `register`), the same way a `chart` tile's content carries its own `data`.
 */
import { useEffect, useId, useMemo, useState } from "react";
import {
  Badge,
  Button,
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Input,
  MatchHighlight,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Tree,
  cn,
  type TreeNode,
} from "@elabs-ai/components-ui";
import {
  Check,
  ChevronsDownUp,
  ChevronsUpDown,
  ListFilter,
  Lock,
  MoreHorizontal,
  Search,
  Unlock,
  X,
} from "lucide-react";

import type { SelectionSnapshot, SelectionState, SelectionValue } from "../core/selection";
import { useDashboardActions, useSelection } from "../dashboard-sheet";
import type { DashboardTileKind, DashboardTileProps } from "../dashboard-sheet/tile-registry";
import {
  buildLevelTree,
  buildParentChildTree,
  descendantsOf,
  expandedToLevel,
  filterTree,
  flattenTree,
  type FilterTileLevel,
  type FilterTileParentChild,
  type FilterTreeNode,
} from "./filter-tree";

export type { FilterTileLevel, FilterTileParentChild, FilterTreeNode } from "./filter-tree";

/** How `filter` applies a click: one value at a time (replaces) or several (toggles). */
export type FilterTileMode = "single" | "multi";

/** How `filter` orders rows within the non-excluded and excluded groups. */
export type FilterTileSort = "value" | "frequency";

/** One value `filter` can show, with its optional label and row count. */
export interface FilterTileValue {
  value: SelectionValue;
  /** Shown instead of the raw value. */
  label?: string;
  /** Row count; shown when `showCounts` is set. */
  count?: number;
}

/** Content of a `filter` tile. */
export interface FilterTileContent {
  /** The data field this filter selects on (the flat list; the first level of a tree). */
  field: string;
  /** Label shown in the tile's own header row; defaults to `field`. */
  label?: string;
  /** Pick one value (replaces the selection) or several (toggles). Default `multi`. */
  mode?: FilterTileMode;
  /** Show the search input (flat: always; tree: a toggle in the header). Default `false`. */
  search?: boolean;
  /** Show each row's count. Default `false`. */
  showCounts?: boolean;
  /** Row order within the non-excluded and excluded groups (flat list). Default `value`. */
  sort?: FilterTileSort;
  /** The field's known values (host-supplied — see the module doc). Flat list only. */
  values: FilterTileValue[];
  /** A multi-level hierarchy (2–6 fields, root first) read from `rows`. */
  levels?: FilterTileLevel[];
  /** A parent-child hierarchy read from `rows`. Wins over `levels` when both are set. */
  parentChild?: FilterTileParentChild;
  /** The hierarchy's records: one per leaf path (`levels`) or one per node (`parentChild`); an optional `count` per row. */
  rows?: Array<Record<string, SelectionValue | null | undefined>>;
  /** How deep the tree opens at first: `0` collapsed, `1` (default), `2`, …, `-1` everything. */
  expandLevel?: number;
  /** Only leaves select; clicking a parent expands or collapses it. Default `false`. */
  leafOnly?: boolean;
  /** Selecting a parent also selects every descendant. Default `false`. */
  selectWithChildren?: boolean;
  /** Compact rows. Default `false`. */
  dense?: boolean;
  /** Clicks collect into a pending session applied on Confirm (the native filter-pane way). Default `false`. */
  confirm?: boolean;
}

/** Strings `filter` renders. Pass your own to `createFilterTileKind` to localise. */
/** Below this pixel height the tile shows the collapsed bar + popover instead of a list. */
export const COLLAPSED_BAR_MAX_HEIGHT = 100;

export interface FilterTileLabels {
  search: (label: string) => string;
  empty: string;
  clear: string;
  lock: (label: string) => string;
  unlock: (label: string) => string;
  moreActions: (label: string) => string;
  locked: string;
  valueState: (label: string, state: SelectionState) => string;
  expandAll: string;
  collapseAll: string;
  toggleSearch: string;
  confirm: string;
  cancel: string;
  /** The collapsed bar's summary: `n` selected values across the tile's fields. */
  selectedCount: (n: number) => string;
  noSelection: string;
  open: (label: string) => string;
  leafOnly: string;
  selectWithChildren: string;
  dense: string;
}

/** The labels `filter` uses when a host passes none. */
export const DEFAULT_FILTER_TILE_LABELS: FilterTileLabels = {
  search: (label) => `Search ${label}…`,
  empty: "No values match.",
  clear: "Clear",
  lock: (label) => `Lock ${label}`,
  unlock: (label) => `Unlock ${label}`,
  moreActions: (label) => `${label} actions`,
  locked: "Locked",
  valueState: (label, state) =>
    state === "selected"
      ? `${label}, selected`
      : state === "excluded"
        ? `${label}, excluded`
        : label,
  expandAll: "Expand all",
  collapseAll: "Collapse all",
  toggleSearch: "Search",
  confirm: "Confirm selection",
  cancel: "Cancel selection",
  selectedCount: (n) => `${n} selected`,
  noSelection: "No selection",
  open: (label) => `Open ${label}`,
  leafOnly: "Select leaves only",
  selectWithChildren: "Select with children",
  dense: "Dense rows",
};

function compareValues(a: SelectionValue, b: SelectionValue): number {
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a).localeCompare(String(b));
}

/** Non-excluded rows first (Qlik's ordering), each group ordered by `sort`. */
function sortRows(
  rows: readonly FilterTileValue[],
  states: ReadonlyMap<SelectionValue, SelectionState>,
  sort: FilterTileSort,
): FilterTileValue[] {
  const rank = (row: FilterTileValue) => (states.get(row.value) === "excluded" ? 1 : 0);
  return [...rows].sort((a, b) => {
    const byRank = rank(a) - rank(b);
    if (byRank !== 0) return byRank;
    if (sort === "frequency") return (b.count ?? 0) - (a.count ?? 0);
    return compareValues(a.value, b.value);
  });
}

// ---------------------------------------------------------------------------
// Selection session — the pending set a `confirm` tile collects before applying.
// ---------------------------------------------------------------------------

type Pending = Map<string, Set<SelectionValue>>;

function pendingFromSnapshot(snapshot: SelectionSnapshot, fields: readonly string[]): Pending {
  const out: Pending = new Map();
  for (const field of fields) out.set(field, new Set(snapshot.fields[field]?.values ?? []));
  return out;
}

function samePending(a: Pending, b: Pending): boolean {
  if (a.size !== b.size) return false;
  for (const [field, values] of a) {
    const other = b.get(field);
    if (!other || other.size !== values.size) return false;
    for (const value of values) if (!other.has(value)) return false;
  }
  return true;
}

/**
 * One selection surface (flat or tree): resolves each value's state, applies clicks
 * immediately or into a pending session, and exposes what the header needs.
 */
function useFilterSession(props: DashboardTileProps<FilterTileContent>, fields: readonly string[]) {
  const { tile, selection, emit, interactions } = props;
  const content = tile.content;
  const mode = content?.mode ?? "multi";
  const confirm = content?.confirm === true;
  const [pending, setPending] = useState<Pending | null>(null);

  // A new driver snapshot (someone else selected) ends a stale session.
  useEffect(() => {
    if (pending) setPending(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset only when the snapshot changes
  }, [selection]);

  const stateOf = (field: string, value: SelectionValue): SelectionState => {
    if (pending) {
      const set = pending.get(field);
      if (set?.has(value)) return "selected";
      const driver = selection.states(field, value);
      // A value the session deselected is back to "associated" (it was selectable).
      return driver === "selected" ? "associated" : driver;
    }
    return selection.states(field, value);
  };

  const locked = fields.some((field) => Boolean(selection.fields[field]?.locked));
  const interactive = interactions.select !== false && !locked;

  const apply = (field: string, values: SelectionValue[], replace: boolean) => {
    if (replace) emit.select(field, values, { replace: true });
    else emit.select(field, values, { toggle: true });
  };

  /** Toggle `value` in `field` (with `extra` descendants flipped to the same target state). */
  const toggle = (field: string, value: SelectionValue, extra: FilterTreeNode[] = []) => {
    if (!interactive) return;
    if (confirm) {
      const base = pending ?? pendingFromSnapshot(selection, fields);
      const next: Pending = new Map([...base].map(([f, set]) => [f, new Set(set)]));
      const set = next.get(field) ?? new Set<SelectionValue>();
      next.set(field, set);
      const target = !set.has(value);
      if (mode === "single") set.clear();
      if (target) set.add(value);
      else set.delete(value);
      for (const node of extra) {
        const childSet = next.get(node.field) ?? new Set<SelectionValue>();
        next.set(node.field, childSet);
        if (target) childSet.add(node.value);
        else childSet.delete(node.value);
      }
      setPending(next);
      return;
    }
    const target = selection.states(field, value) !== "selected";
    if (mode === "single") {
      apply(field, [value], true);
    } else {
      apply(field, [value], false);
    }
    // Descendants: flip only those not already in the target state, so the toggle lands
    // every child on the same side as its parent.
    const byField = new Map<string, SelectionValue[]>();
    for (const node of extra) {
      const isSelected = selection.states(node.field, node.value) === "selected";
      if (isSelected === target) continue;
      const list = byField.get(node.field) ?? [];
      list.push(node.value);
      byField.set(node.field, list);
    }
    for (const [childField, values] of byField) apply(childField, values, false);
  };

  const confirmSession = () => {
    if (!pending) return;
    const before = pendingFromSnapshot(selection, fields);
    for (const [field, set] of pending) {
      const was = before.get(field) ?? new Set<SelectionValue>();
      const changed = [
        ...[...set].filter((v) => !was.has(v)),
        ...[...was].filter((v) => !set.has(v)),
      ];
      if (changed.length > 0) apply(field, changed, false);
    }
    setPending(null);
  };
  const cancelSession = () => setPending(null);

  const dirty = pending !== null && !samePending(pending, pendingFromSnapshot(selection, fields));
  const selectedCount = fields.reduce((sum, field) => {
    const set = pending?.get(field);
    return sum + (set ? set.size : (selection.fields[field]?.values.length ?? 0));
  }, 0);

  return {
    stateOf,
    toggle,
    interactive,
    locked,
    confirm,
    dirty,
    confirmSession,
    cancelSession,
    selectedCount,
  };
}

type Session = ReturnType<typeof useFilterSession>;

// ---------------------------------------------------------------------------
// Bodies
// ---------------------------------------------------------------------------

/** The check glyph + label + count, the same row anatomy in the flat list and the tree. */
function ValueRow({
  label,
  state,
  count,
  query,
  showCounts,
}: {
  label: string;
  state: SelectionState;
  count?: number;
  query?: string;
  showCounts?: boolean;
}) {
  return (
    <>
      <span
        aria-hidden="true"
        className={cn(
          "flex size-4 shrink-0 items-center justify-center rounded-sm border border-input transition-colors duration-fast ease-standard",
          state === "selected" && "border-primary bg-primary text-primary-foreground",
        )}
      >
        {state === "selected" ? <Check className="size-3.5" /> : null}
      </span>
      <span className="min-w-0 flex-1 truncate">
        {query ? <MatchHighlight text={label} query={query} /> : label}
      </span>
      {showCounts && count !== undefined ? (
        <Badge variant="outline" className="shrink-0 tabular-nums">
          {count}
        </Badge>
      ) : null}
    </>
  );
}

/** Excluded rows keep running TEXT: `muted-foreground` ink (AA in every theme) plus a dashed
 * frame at full opacity — the shape channel `.claude/rules/dashboard.md` requires, never the
 * chart-mark ghost opacity, which would drop text below 4.5:1. */
const EXCLUDED_ROW = "border border-dashed border-chart-foreground text-muted-foreground";

function FlatList({
  props,
  session,
  labels,
  titleId,
  search,
}: {
  props: DashboardTileProps<FilterTileContent>;
  session: Session;
  labels: FilterTileLabels;
  titleId: string;
  search: boolean;
}) {
  const content = props.tile.content;
  const field = content?.field ?? "";
  const label = content?.label ?? field;
  const sort = content?.sort ?? "value";
  const values = useMemo(() => content?.values ?? [], [content?.values]);
  const states = useMemo(() => {
    const map = new Map<SelectionValue, SelectionState>();
    for (const row of values) map.set(row.value, session.stateOf(field, row.value));
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- stateOf is rebuilt per render; its inputs are `values`, the snapshot and the pending session
  }, [values, field, props.selection, session.dirty]);
  const rows = useMemo(() => sortRows(values, states, sort), [values, states, sort]);

  return (
    <Command
      className={cn("min-h-0 flex-1 bg-transparent", content?.dense && "[&_[cmdk-item]]:py-1")}
      aria-labelledby={titleId}
    >
      {search ? (
        <CommandInput placeholder={labels.search(label)} aria-label={labels.search(label)} />
      ) : null}
      {/* Without a search box the list is the only thing to focus: the scroll region is a
       * focusable wrapper (cmdk pins its own list to tabindex -1), so keyboard users can reach
       * and scroll it (axe scrollable-region-focusable). */}
      <div
        className={cn("min-h-0 flex-1 overflow-auto", !search && "focus-ring-inset")}
        tabIndex={search ? undefined : 0}
        aria-labelledby={search ? undefined : titleId}
      >
        <CommandList className="max-h-none overflow-visible">
          <CommandEmpty>{labels.empty}</CommandEmpty>
          <CommandGroup>
            {rows.map((row) => {
              const state = states.get(row.value) ?? "associated";
              const rowLabel = row.label ?? String(row.value);
              return (
                <CommandItem
                  key={String(row.value)}
                  value={rowLabel}
                  aria-label={labels.valueState(rowLabel, state)}
                  data-selection={state}
                  disabled={!session.interactive}
                  onSelect={() => session.toggle(field, row.value)}
                  className={cn(
                    "gap-2",
                    state === "selected" && "bg-accent/10",
                    state === "excluded" && EXCLUDED_ROW,
                  )}
                >
                  <ValueRow
                    label={rowLabel}
                    state={state}
                    count={row.count}
                    showCounts={content?.showCounts}
                  />
                </CommandItem>
              );
            })}
          </CommandGroup>
        </CommandList>
      </div>
    </Command>
  );
}

function HierarchyTree({
  props,
  session,
  labels,
  titleId,
  tree,
  search,
  query,
  onQueryChange,
  expandedIds,
  onExpandedChange,
}: {
  props: DashboardTileProps<FilterTileContent>;
  session: Session;
  labels: FilterTileLabels;
  titleId: string;
  tree: FilterTreeNode[];
  search: boolean;
  query: string;
  onQueryChange: (query: string) => void;
  expandedIds: string[];
  onExpandedChange: (ids: string[]) => void;
}) {
  const content = props.tile.content;
  const label = content?.label ?? content?.field ?? "";
  const leafOnly = content?.leafOnly === true;
  const withChildren = content?.selectWithChildren === true && !leafOnly;
  const showCounts = content?.showCounts === true;

  const visible = useMemo(() => filterTree(tree, query), [tree, query]);
  const byId = useMemo(() => new Map(flattenTree(tree).map((node) => [node.id, node])), [tree]);
  // A search reveals its matches: every expandable node of the pruned tree is open.
  const effectiveExpanded = query.trim() ? expandedToLevel(visible, -1) : expandedIds;

  const selectedIds = useMemo(
    () =>
      flattenTree(visible)
        .filter((node) => session.stateOf(node.field, node.value) === "selected")
        .map((node) => node.id),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- stateOf reads the snapshot + pending session
    [visible, props.selection, session.dirty],
  );

  const toNodes = (list: readonly FilterTreeNode[]): TreeNode<FilterTreeNode>[] =>
    list.map((node) => {
      const state = session.stateOf(node.field, node.value);
      const parent = node.children.length > 0;
      return {
        id: node.id,
        data: node,
        label: (
          <span
            data-selection={state}
            aria-label={labels.valueState(node.label, state)}
            className={cn(
              "flex min-w-0 flex-1 items-center gap-2 rounded-sm px-1",
              state === "excluded" && EXCLUDED_ROW,
              leafOnly && parent && "text-muted-foreground",
            )}
          >
            <ValueRow
              label={node.label}
              state={state}
              count={node.count}
              query={query}
              showCounts={showCounts}
            />
          </span>
        ),
        children: node.children.length > 0 ? toNodes(node.children) : undefined,
      };
    });
  const nodes = useMemo(
    () => toNodes(visible),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- rebuilt when the pruned tree, the query or any state changes
    [visible, query, props.selection, session.dirty, leafOnly, showCounts],
  );

  const onSelectionChange = (ids: string[]) => {
    // The Tree reports the whole set; the click is the one id whose membership changed.
    const before = new Set(selectedIds);
    const after = new Set(ids);
    const changed =
      [...after].find((id) => !before.has(id)) ?? [...before].find((id) => !after.has(id));
    const node = changed ? byId.get(changed) : undefined;
    if (!node) return;
    if (leafOnly && node.children.length > 0) {
      onExpandedChange(
        effectiveExpanded.includes(node.id)
          ? effectiveExpanded.filter((id) => id !== node.id)
          : [...effectiveExpanded, node.id],
      );
      return;
    }
    session.toggle(node.field, node.value, withChildren ? descendantsOf(node) : []);
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-1">
      {search ? (
        <div className="relative shrink-0">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute start-2 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape" && query) {
                event.stopPropagation();
                onQueryChange("");
              }
            }}
            placeholder={labels.search(label)}
            aria-label={labels.search(label)}
            className="h-8 ps-8"
          />
        </div>
      ) : null}
      {nodes.length === 0 ? (
        <p className="px-2 py-3 text-caption text-muted-foreground">{labels.empty}</p>
      ) : (
        <Tree
          aria-labelledby={titleId}
          data-slot="filter-tile-tree"
          nodes={nodes}
          selectionMode="multiple"
          expandOn="chevron"
          selectedIds={selectedIds}
          onSelectionChange={session.interactive ? onSelectionChange : () => {}}
          expandedIds={effectiveExpanded}
          onExpandedChange={onExpandedChange}
          className={cn(
            "min-h-0 flex-1 overflow-auto",
            content?.dense && "[&_[role=treeitem]]:min-h-7 [&_[role=treeitem]]:py-0",
          )}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// The tile
// ---------------------------------------------------------------------------

function createFilterTileComponent(labels: FilterTileLabels) {
  return function FilterTile(props: DashboardTileProps<FilterTileContent>) {
    const { tile, size } = props;
    const content = tile.content;
    const field = content?.field ?? "";
    const label = content?.label ?? field;
    const titleId = useId();
    const actions = useDashboardActions();

    // Which body: a parent-child table, a level hierarchy, or the flat list.
    const tree = useMemo<FilterTreeNode[] | null>(() => {
      const rows = content?.rows ?? [];
      if (content?.parentChild) return buildParentChildTree(content.parentChild, rows);
      if (content?.levels && content.levels.length > 0) return buildLevelTree(content.levels, rows);
      return null;
    }, [content?.rows, content?.parentChild, content?.levels]);
    const fields = useMemo(
      () =>
        content?.parentChild
          ? [content.parentChild.childField]
          : content?.levels?.length
            ? content.levels.map((level) => level.field)
            : [field],
      [content?.parentChild, content?.levels, field],
    );
    const session = useFilterSession(props, fields);
    const firstField = fields[0] ?? field;
    const firstSelection = useSelection(firstField);
    const hasSelection = session.selectedCount > 0;

    // Tree chrome state: expanded set (seeded from `expandLevel`), search toggle and query.
    const expandLevel = content?.expandLevel ?? 1;
    const [expandedIds, setExpandedIds] = useState<string[]>(() =>
      tree ? expandedToLevel(tree, expandLevel) : [],
    );
    useEffect(() => {
      if (tree) setExpandedIds(expandedToLevel(tree, expandLevel));
    }, [tree, expandLevel]);
    const [searchOpen, setSearchOpen] = useState(false);
    const [query, setQuery] = useState("");
    const [open, setOpen] = useState(false);
    // Too SHORT for a list (one grid row, a filter squeezed into a banner) → the collapsed bar.
    // Height alone decides: a narrow, tall filter column is the classic filter-pane layout and
    // must stay a list even though its tier is `xs`.
    const collapsedBar = size.height < COLLAPSED_BAR_MAX_HEIGHT;
    const searchVisible = Boolean(content?.search) && (tree ? searchOpen || open : true);

    const expandAll = () => tree && setExpandedIds(expandedToLevel(tree, -1));
    const collapseAll = () => setExpandedIds([]);

    const header = (inPopover: boolean) => (
      <div className="flex shrink-0 items-center justify-between gap-1">
        <span
          id={inPopover ? undefined : titleId}
          className="min-w-0 truncate text-meta font-medium text-foreground"
        >
          {session.locked ? (
            <Lock
              aria-hidden="true"
              className="me-1 inline size-3 align-text-top text-muted-foreground"
            />
          ) : null}
          {label}
        </span>
        <span className="flex shrink-0 items-center">
          {session.confirm && session.dirty ? (
            <>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={labels.cancel}
                data-slot="filter-tile-cancel"
                onClick={session.cancelSession}
              >
                <X aria-hidden="true" />
              </Button>
              <Button
                variant="default"
                size="icon-sm"
                aria-label={labels.confirm}
                data-slot="filter-tile-confirm"
                onClick={session.confirmSession}
              >
                <Check aria-hidden="true" />
              </Button>
            </>
          ) : null}
          {tree && content?.search && !inPopover ? (
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={labels.toggleSearch}
              aria-pressed={searchOpen}
              onClick={() => {
                setSearchOpen((v) => !v);
                if (searchOpen) setQuery("");
              }}
            >
              <Search aria-hidden="true" />
            </Button>
          ) : null}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-sm" aria-label={labels.moreActions(label)}>
                <MoreHorizontal aria-hidden="true" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                disabled={!hasSelection || session.locked}
                onSelect={() => {
                  for (const f of fields) actions.clearSelection(f);
                }}
              >
                {labels.clear}
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() => {
                  for (const f of fields) actions.lock(f, !session.locked);
                }}
              >
                {session.locked ? <Unlock aria-hidden="true" /> : <Lock aria-hidden="true" />}
                {session.locked ? labels.unlock(label) : labels.lock(label)}
              </DropdownMenuItem>
              {tree ? (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={expandAll}>
                    <ChevronsUpDown aria-hidden="true" />
                    {labels.expandAll}
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={collapseAll}>
                    <ChevronsDownUp aria-hidden="true" />
                    {labels.collapseAll}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuCheckboxItem checked={content?.leafOnly === true} disabled>
                    {labels.leafOnly}
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem checked={content?.selectWithChildren === true} disabled>
                    {labels.selectWithChildren}
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem checked={content?.dense === true} disabled>
                    {labels.dense}
                  </DropdownMenuCheckboxItem>
                </>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
        </span>
      </div>
    );

    const body = (inPopover: boolean) =>
      tree ? (
        <HierarchyTree
          props={props}
          session={session}
          labels={labels}
          titleId={titleId}
          tree={tree}
          search={Boolean(content?.search) && (inPopover || searchOpen)}
          query={query}
          onQueryChange={setQuery}
          expandedIds={expandedIds}
          onExpandedChange={setExpandedIds}
        />
      ) : (
        <FlatList
          props={props}
          session={session}
          labels={labels}
          titleId={titleId}
          search={searchVisible}
        />
      );

    // Collapsed bar (`xs`): the label and the selection summary; the full panel in a popover.
    if (collapsedBar) {
      const summary = hasSelection
        ? labels.selectedCount(session.selectedCount)
        : labels.noSelection;
      return (
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              data-slot="filter-tile"
              data-tile-kind={tile.kind}
              data-collapsed=""
              aria-label={labels.open(label)}
              className="flex size-full min-h-0 items-center gap-2 rounded-md px-1 text-start focus-ring hover:bg-muted"
            >
              <ListFilter aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1 truncate text-meta font-medium text-foreground">
                {label}
              </span>
              <Badge
                variant={hasSelection ? "default" : "outline"}
                className="shrink-0 tabular-nums"
              >
                {summary}
              </Badge>
            </button>
          </PopoverTrigger>
          <PopoverContent
            align="start"
            aria-label={label}
            className="flex h-80 w-72 flex-col gap-1 p-2"
          >
            {header(true)}
            {body(true)}
          </PopoverContent>
        </Popover>
      );
    }

    return (
      <div
        data-slot="filter-tile"
        data-tile-kind={tile.kind}
        data-hierarchy={tree ? (content?.parentChild ? "parent-child" : "levels") : undefined}
        className="flex size-full min-h-0 flex-col gap-1"
      >
        {header(false)}
        {body(false)}
        <span className="sr-only" aria-live="polite">
          {firstSelection.state?.locked ? labels.locked : ""}
        </span>
      </div>
    );
  };
}

/** Build a `filter` tile kind. `kind` lets a host register several presets; `labels` (partial, merged over the defaults) localises. */
export function createFilterTileKind(
  kind = "filter",
  labelsProp: Partial<FilterTileLabels> = {},
): DashboardTileKind<FilterTileContent> {
  const labels: FilterTileLabels = { ...DEFAULT_FILTER_TILE_LABELS, ...labelsProp };
  return {
    kind,
    label: "Filter", // i18n-exempt: asset-panel label of a tile kind, mirrors placeholderTileKind
    icon: ListFilter,
    description: "A field’s values, flat or as a hierarchy, to select from.", // i18n-exempt: asset-panel description
    component: createFilterTileComponent(labels),
    defaultSize: { w: 4, h: 6 },
    minSize: { w: 3, h: 1 },
    capabilities: { emitsSelection: true, consumesSelection: true, expand: true },
    configForm: {
      formName: `${kind}-tile`,
      fields: [
        { type: "string", name: "field", label: "Field", required: true }, // i18n-exempt: config-form label
        { type: "string", name: "label", label: "Label" }, // i18n-exempt: config-form label
        {
          type: "enum",
          name: "mode",
          label: "Selection", // i18n-exempt: config-form label
          options: [
            { const: "multi", title: "Several values" }, // i18n-exempt: config-form label
            { const: "single", title: "One value" }, // i18n-exempt: config-form label
          ],
          default: "multi",
        },
        { type: "boolean", name: "search", label: "Search box", default: false }, // i18n-exempt: config-form label
        { type: "boolean", name: "showCounts", label: "Show counts", default: false }, // i18n-exempt: config-form label
        { type: "boolean", name: "confirm", label: "Confirm before applying", default: false }, // i18n-exempt: config-form label
        {
          type: "integer",
          name: "expandLevel",
          label: "Expand to level", // i18n-exempt: config-form label
          min: -1,
          max: 6,
          default: 1,
        },
        { type: "boolean", name: "leafOnly", label: "Select leaves only", default: false }, // i18n-exempt: config-form label
        {
          type: "boolean",
          name: "selectWithChildren",
          label: "Select with children", // i18n-exempt: config-form label
          default: false,
        },
        { type: "boolean", name: "dense", label: "Dense rows", default: false }, // i18n-exempt: config-form label
      ],
      sections: [
        { id: "data", label: "Data", fields: ["field", "label", "mode"] }, // i18n-exempt: config-form label
        { id: "appearance", label: "Appearance", fields: ["search", "showCounts", "dense"] }, // i18n-exempt: config-form label
        {
          id: "hierarchy",
          label: "Hierarchy", // i18n-exempt: config-form label
          fields: ["expandLevel", "leafOnly", "selectWithChildren", "confirm"],
        },
      ],
    },
    defaultContent: { field: "", values: [] },
  };
}

/** `createFilterTileKind()` — the `filter` kind. */
export const filterTileKind = createFilterTileKind();
