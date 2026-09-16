"use client";

import { forwardRef, useMemo, type HTMLAttributes } from "react";
import {
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  cn,
} from "@elabs-ai/components-ui";

import {
  isDrillEffect,
  resolveInteractions,
  tileConsumesSelection,
  type InteractionEffect,
} from "../core/interactions";
import type { DashboardSpec, InteractionSpec, TileSpec } from "../core/spec";
import { useDashboard, useDashboardActions } from "../dashboard-sheet/use-dashboard";
import type { DashboardAssetSheet } from "./dashboard-asset-panel";

/** Sheets with at most this many tiles edit as a matrix; larger ones as a list. */
export const INTERACTIONS_MATRIX_MAX_TILES = 12;

/** Every visible string and accessible name the interactions editor renders. */
export interface DashboardInteractionsEditorLabels {
  title: string;
  description: string;
  /** Matrix caption (rows = emitters, columns = consumers). */
  caption: string;
  /** Header of the matrix's corner cell. */
  corner: string;
  filter: string;
  highlight: string;
  none: string;
  /** A drill option. */
  drill: (sheetLabel: string) => string;
  /** Accessible name of one pair's select, e.g. "Revenue by month → Region filter: Filter". */
  pair: (from: string, to: string, effect: string) => string;
  /** Shown when the sheet has no emitter or no consumer. */
  empty: string;
  /** Name of a tile with no title. */
  untitled: (id: string) => string;
}

/** The editor's labels when the host passes none. */
export const DEFAULT_DASHBOARD_INTERACTIONS_EDITOR_LABELS: DashboardInteractionsEditorLabels = {
  title: "Edit interactions",
  description: "Choose what a selection in one tile does to each other tile.",
  caption: "Rows publish selections; columns receive them.",
  corner: "From ↓ / To →",
  filter: "Filter",
  highlight: "Highlight",
  none: "None",
  drill: (sheet) => `Drill to ${sheet}`,
  pair: (from, to, effect) => `${from} → ${to}: ${effect}`,
  empty: "No tile on this sheet both publishes and receives selections.",
  untitled: (id) => id,
};

export interface DashboardInteractionsEditorProps extends HTMLAttributes<HTMLDivElement> {
  /** Edit only this emitter's row. */
  tileId?: string;
  /** Sheets a pair may drill to. */
  sheets?: DashboardAssetSheet[];
  /** Strings; merged over `DEFAULT_DASHBOARD_INTERACTIONS_EDITOR_LABELS`. */
  labels?: Partial<DashboardInteractionsEditorLabels>;
}

const DRILL_PREFIX = "drill:";

function effectValue(effect: InteractionEffect): string {
  return isDrillEffect(effect) ? `${DRILL_PREFIX}${effect.drill.sheetId}` : effect;
}

/** `spec.interactions` with the (from, to) pair set explicitly to `effect`. */
export function setInteractionPair(
  spec: DashboardSpec,
  from: string,
  to: string,
  effect: InteractionEffect,
): InteractionSpec[] {
  const rest = (spec.interactions ?? []).filter((i) => !(i.from === from && i.to === to));
  return [...rest, { from, to, effect }];
}

/**
 * Edit `spec.interactions[]` (RM-082): a matrix (`ui/Table`, rows = emitters, columns = consumers,
 * one `ui/Select` per pair) for sheets of at most `INTERACTIONS_MATRIX_MAX_TILES` tiles, a list
 * grouped by emitter otherwise. Each change writes one explicit pair as ONE history entry. A drill
 * carries the emitter's `emits.selection` fields. Precedence: `core/interactions.ts`.
 */
export const DashboardInteractionsEditor = forwardRef<
  HTMLDivElement,
  DashboardInteractionsEditorProps
>(function DashboardInteractionsEditor(
  { tileId, sheets, labels: labelsProp, className, ...props },
  ref,
) {
  const labels = useMemo(
    () => ({ ...DEFAULT_DASHBOARD_INTERACTIONS_EDITOR_LABELS, ...labelsProp }),
    [labelsProp],
  );
  const spec = useDashboard((s) => s.spec);
  const actions = useDashboardActions();
  const map = useMemo(() => resolveInteractions(spec), [spec]);

  const name = (tile: TileSpec) => tile.title || labels.untitled(tile.id);
  const emitters = spec.tiles.filter(
    (tile) => Boolean(tile.emits?.selection) && (tileId === undefined || tile.id === tileId),
  );
  const consumers = spec.tiles.filter(tileConsumesSelection);
  const layout = spec.tiles.length <= INTERACTIONS_MATRIX_MAX_TILES ? "matrix" : "list";

  const options = [
    { value: "filter", label: labels.filter },
    { value: "highlight", label: labels.highlight },
    { value: "none", label: labels.none },
    ...(sheets ?? []).map((sheet) => ({
      value: `${DRILL_PREFIX}${sheet.id}`,
      label: labels.drill(sheet.label),
    })),
  ];
  const optionLabel = (value: string) =>
    options.find((option) => option.value === value)?.label ?? value;

  const change = (from: TileSpec, to: TileSpec, value: string) => {
    const effect: InteractionEffect = value.startsWith(DRILL_PREFIX)
      ? {
          drill: {
            sheetId: value.slice(DRILL_PREFIX.length),
            carry: [...(from.emits?.selection ?? [])],
          },
        }
      : (value as "filter" | "highlight" | "none");
    const current = map.get(from.id)?.find((pair) => pair.to === to.id)?.effect;
    if (current !== undefined && effectValue(current) === value) return;
    const latest = spec;
    actions.batch(() =>
      actions.setSpec({
        ...latest,
        interactions: setInteractionPair(latest, from.id, to.id, effect),
      }),
    );
  };

  const cell = (from: TileSpec, to: TileSpec) => {
    const effect = map.get(from.id)?.find((pair) => pair.to === to.id)?.effect ?? "filter";
    const value = effectValue(effect);
    return (
      <Select value={value} onValueChange={(next) => change(from, to, next)}>
        <SelectTrigger
          size="sm"
          className="min-w-28"
          aria-label={labels.pair(name(from), name(to), optionLabel(value))}
          data-from={from.id}
          data-to={to.id}
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  };

  const empty = emitters.length === 0 || consumers.length === 0;

  return (
    <div
      ref={ref}
      data-slot="dashboard-interactions-editor"
      data-layout={layout}
      className={cn("flex min-w-0 flex-col gap-3", className)}
      {...props}
    >
      {empty ? (
        <p className="text-body text-muted-foreground">{labels.empty}</p>
      ) : layout === "matrix" ? (
        <Table data-slot="dashboard-interactions-editor-matrix">
          <TableCaption>{labels.caption}</TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead scope="col">{labels.corner}</TableHead>
              {consumers.map((to) => (
                <TableHead key={to.id} scope="col">
                  {name(to)}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {emitters.map((from) => (
              <TableRow key={from.id}>
                <TableHead scope="row">{name(from)}</TableHead>
                {consumers.map((to) => (
                  <TableCell key={to.id}>{to.id === from.id ? null : cell(from, to)}</TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : (
        <div data-slot="dashboard-interactions-editor-list" className="flex flex-col gap-4">
          {emitters.map((from) => (
            <section key={from.id} aria-label={name(from)} className="flex flex-col gap-2">
              <h3 className="text-subtitle">{name(from)}</h3>
              <ul className="flex flex-col gap-1">
                {consumers
                  .filter((to) => to.id !== from.id)
                  .map((to) => (
                    <li key={to.id} className="flex min-w-0 items-center justify-between gap-3">
                      <span className="min-w-0 truncate text-body">{name(to)}</span>
                      {cell(from, to)}
                    </li>
                  ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
});

export interface DashboardInteractionsDialogProps extends DashboardInteractionsEditorProps {
  /** Trigger text; the properties panel's "Edit interactions…". */
  triggerLabel: string;
}

/**
 * The editor in a `ui/Dialog` behind a button — what the properties panel's Interactions section
 * renders, scoped to the focused tile via `tileId`.
 */
export const DashboardInteractionsDialog = forwardRef<
  HTMLDivElement,
  DashboardInteractionsDialogProps
>(function DashboardInteractionsDialog({ triggerLabel, labels, ...props }, ref) {
  const merged = { ...DEFAULT_DASHBOARD_INTERACTIONS_EDITOR_LABELS, ...labels };
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" data-slot="dashboard-interactions-dialog-trigger">
          {triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent size="xl" data-slot="dashboard-interactions-dialog">
        <DialogHeader>
          <DialogTitle>{merged.title}</DialogTitle>
          <DialogDescription>{merged.description}</DialogDescription>
        </DialogHeader>
        <DialogBody>
          <DashboardInteractionsEditor ref={ref} labels={labels} {...props} />
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
});
