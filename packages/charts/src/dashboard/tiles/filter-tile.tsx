"use client";

/**
 * `filter` tile (RM-076, analysis §4 R13/R19/R23) — a searchable value list bound to one
 * selection field, drawn with the tri-state selected/associated/excluded encoding.
 *
 * `data/FacetFilter` is the closest existing component, but `dashboard/` may only import
 * `charts`/`ui`/`tokens`/`icons` (`.claude/rules/dashboard.md`), so this composes
 * `ui/Command` (the searchable, roving, type-ahead list) and `ui/Badge` directly instead.
 * The per-row check mark is a plain `aria-hidden` glyph, not `ui/Checkbox` — `Checkbox`
 * renders a real (focusable-capable) `<button role="checkbox">`, and nesting one inside
 * `CommandItem`'s `role="option"` fails axe's `nested-interactive` rule even with
 * `tabIndex={-1}`/`aria-hidden`; the whole row is the one interactive target
 * (`aria-label={labels.valueState(...)}` already carries the checked state).
 *
 * `content.values` is the field's known domain. There is no way to ask a `SelectionDriver`
 * to enumerate a field's values — `SelectionDriver.register` only feeds the LOCAL driver's
 * own association bookkeeping, and `DashboardTileProps` never hands a tile the driver
 * itself (by design: only the host that owns the data should touch `register`, D5). So
 * `filter`'s content carries its own domain, the same way a `chart` tile's content already
 * carries its own `data` rows (see `core/__fixtures__/sales-overview.json`) — the sheet has
 * no data engine of its own. Per-value STATE still comes from the live `selection`
 * snapshot (`useSelection(field)`), so it stays correct for any driver, local or a host
 * engine.
 */
import { useId, useMemo } from "react";
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
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  cn,
} from "@elabs-ai/components-ui";
import { Check, ListFilter, Lock, MoreHorizontal, Unlock } from "lucide-react";

import type { SelectionState, SelectionValue } from "../core/selection";
import { useDashboardActions, useSelection } from "../dashboard-sheet";
import type { DashboardTileKind, DashboardTileProps } from "../dashboard-sheet/tile-registry";

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
  /** The data field this filter selects on. */
  field: string;
  /** Label shown in the tile's own header row; defaults to `field`. */
  label?: string;
  /** Pick one value (replaces the selection) or several (toggles). Default `multi`. */
  mode?: FilterTileMode;
  /** Show the search input. Default `false`. */
  search?: boolean;
  /** Show each row's count. Default `false`. */
  showCounts?: boolean;
  /** Row order within the non-excluded and excluded groups. Default `value`. */
  sort?: FilterTileSort;
  /** The field's known values (host-supplied — see the module doc). */
  values: FilterTileValue[];
}

/** Strings `filter` renders. Pass your own to `createFilterTileKind` to localise. */
export interface FilterTileLabels {
  search: (label: string) => string;
  empty: string;
  clear: string;
  lock: (label: string) => string;
  unlock: (label: string) => string;
  moreActions: (label: string) => string;
  locked: string;
  valueState: (label: string, state: SelectionState) => string;
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

function createFilterTileComponent(labels: FilterTileLabels) {
  return function FilterTile({ tile, interactions }: DashboardTileProps<FilterTileContent>) {
    const content = tile.content;
    const field = content?.field ?? "";
    const label = content?.label ?? field;
    const mode = content?.mode ?? "multi";
    const sort = content?.sort ?? "value";
    const values = useMemo(() => content?.values ?? [], [content?.values]);
    const titleId = useId();

    const fieldSelection = useSelection(field);
    const actions = useDashboardActions();
    const locked = Boolean(fieldSelection.state?.locked);
    const hasSelection = (fieldSelection.state?.values.length ?? 0) > 0;
    const interactive = interactions.select !== false && !locked;

    const states = useMemo(() => {
      const map = new Map<SelectionValue, SelectionState>();
      for (const row of values)
        map.set(row.value, fieldSelection.snapshot.states(field, row.value));
      return map;
    }, [values, fieldSelection.snapshot, field]);

    const rows = useMemo(() => sortRows(values, states, sort), [values, states, sort]);

    const toggle = (value: SelectionValue) => {
      if (!interactive) return;
      if (mode === "single") fieldSelection.select([value], { replace: true });
      else fieldSelection.select([value], { toggle: true });
    };

    return (
      <div
        data-slot="filter-tile"
        data-tile-kind={tile.kind}
        className="flex size-full min-h-0 flex-col gap-1"
      >
        <div className="flex shrink-0 items-center justify-between gap-2">
          <span id={titleId} className="min-w-0 truncate text-meta font-medium text-foreground">
            {locked ? (
              <Lock
                aria-hidden="true"
                className="me-1 inline size-3 align-text-top text-muted-foreground"
              />
            ) : null}
            {label}
          </span>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-sm" aria-label={labels.moreActions(label)}>
                <MoreHorizontal aria-hidden="true" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                disabled={!hasSelection || locked}
                onSelect={() => fieldSelection.clear()}
              >
                {labels.clear}
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => actions.lock(field, !locked)}>
                {locked ? <Unlock aria-hidden="true" /> : <Lock aria-hidden="true" />}
                {locked ? labels.unlock(label) : labels.lock(label)}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <Command className="min-h-0 flex-1 bg-transparent" aria-labelledby={titleId}>
          {content?.search ? (
            <CommandInput placeholder={labels.search(label)} aria-label={labels.search(label)} />
          ) : null}
          <CommandList className="max-h-none flex-1">
            <CommandEmpty>{labels.empty}</CommandEmpty>
            <CommandGroup>
              {rows.map((row) => {
                const state = states.get(row.value) ?? "associated";
                const excluded = state === "excluded";
                const rowLabel = row.label ?? String(row.value);
                return (
                  <CommandItem
                    key={String(row.value)}
                    value={rowLabel}
                    aria-label={labels.valueState(rowLabel, state)}
                    data-selection={state}
                    disabled={!interactive}
                    onSelect={() => toggle(row.value)}
                    className={cn(
                      "gap-2",
                      state === "selected" && "bg-accent/10",
                      // Excluded rows still carry running TEXT, so they de-emphasise with the
                      // `muted-foreground` ink (AA against every theme) rather than the shared
                      // chart-mark ghost opacity, which would drop text below 4.5:1 — the dashed
                      // frame (full opacity, a shape channel independent of colour) is the
                      // required second channel per `.claude/rules/dashboard.md`.
                      excluded &&
                        "border border-dashed border-chart-foreground text-muted-foreground",
                    )}
                  >
                    <span
                      aria-hidden="true"
                      className={cn(
                        "flex size-4 shrink-0 items-center justify-center rounded-sm border border-input transition-colors duration-fast ease-standard",
                        state === "selected" && "border-primary bg-primary text-primary-foreground",
                      )}
                    >
                      {state === "selected" ? <Check className="size-3.5" /> : null}
                    </span>
                    <span className="min-w-0 flex-1 truncate">{rowLabel}</span>
                    {content?.showCounts && row.count !== undefined ? (
                      <Badge variant="outline" className="shrink-0 tabular-nums">
                        {row.count}
                      </Badge>
                    ) : null}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </div>
    );
  };
}

/** Build a `filter` tile kind. `kind` lets a host register several presets; `labels` localises. */
export function createFilterTileKind(
  kind = "filter",
  labels: FilterTileLabels = DEFAULT_FILTER_TILE_LABELS,
): DashboardTileKind<FilterTileContent> {
  return {
    kind,
    label: "Filter", // i18n-exempt: asset-panel label of a tile kind, mirrors placeholderTileKind
    icon: ListFilter,
    description: "A field’s values to select from.", // i18n-exempt: asset-panel description
    component: createFilterTileComponent(labels),
    defaultSize: { w: 4, h: 6 },
    minSize: { w: 3, h: 3 },
    capabilities: { emitsSelection: true, consumesSelection: true, expand: true },
    configForm: { formName: `${kind}-tile`, fields: [] },
    defaultContent: { field: "", values: [] },
  };
}

/** `createFilterTileKind()` — the `filter` kind. */
export const filterTileKind = createFilterTileKind();
