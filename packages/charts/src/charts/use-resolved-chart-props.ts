"use client";

/**
 * useResolvedChartProps — a chart's or part's props as its definition resolves them
 * (ADR 0042 §5–6, RM-175): renamed props mapped to their new names first, then every prop
 * the caller left out filled from the definition's defaults.
 *
 * Aliases resolve before anything else reads the props, so a family's controlled /
 * uncontrolled check and its computed defaults see the new name only. Each old name a
 * caller uses warns once per definition and name, in development only.
 *
 * Memoised on `def` and `rawProps`: pass the component's props object as React gave it.
 * When there is nothing to rename or fill, the same object comes back.
 *
 * Families adopt it one by one (the charts-unification track, wave 3). The cartesian core
 * calls it (RM-182): Line, Area, Composed, Bar, Scatter, Candlestick, LiveLine and
 * Waterfall, and the axis and series parts they compose (XAxis, YAxis, BarValueAxis,
 * LiveXAxis, Grid, Bar, Line, Area, Scatter, ReferenceLine), which have no alias rows yet.
 */

import { useMemo } from "react";

import {
  type AnyComponentDefinition,
  type AliasUse,
  applyAliases,
  type NormalizedAliasRow,
  resolveProps,
  type ResolvedProps,
} from "@elabs-ai/components-ui/definition";

import { warnChartOnce } from "./chart-breakpoint";

/**
 * The development warning for a caller still using an old prop name. When the caller gave the
 * new name too, it also says which value was dropped: `use.oldIgnored` (a `new-wins` row) says
 * the old one was; `use.newIgnored` (an `old-wins` row — RM-192's `numTicks` rows are the
 * first) says the new one was (ADR 0042 §8).
 */
function aliasWarning(id: string, row: NormalizedAliasRow, use?: AliasUse): string {
  const warning = `[${id}] "${row.from}" is deprecated and will be removed in ${row.removeIn}. Use "${row.to}".`;
  if (use?.oldIgnored) return `${warning} "${row.from}" was ignored because "${row.to}" is set.`;
  if (use?.newIgnored) return `${warning} "${row.to}" was ignored because "${row.from}" is set.`;
  return warning;
}

/** `rawProps` with each old name mapped to its new one, warning once per old name in development. */
function renameChartProps<Props extends object>(
  def: AnyComponentDefinition,
  rawProps: Props,
): Props {
  return applyAliases(def, rawProps, (row, use) =>
    warnChartOnce(`${def.id}.${row.from}`, aliasWarning(def.id, row, use)),
  );
}

/** `rawProps` with renamed props mapped and the definition's defaults filled in. */
export function useResolvedChartProps<D extends AnyComponentDefinition, Props extends object>(
  def: D,
  rawProps: Props,
): ResolvedProps<Props, D> {
  return useMemo(() => resolveProps(def, renameChartProps(def, rawProps)), [def, rawProps]);
}

/**
 * `rawProps` with renamed props mapped, and nothing else: no defaults filled. For a surface
 * whose definition describes its props but whose defaults still live in its own
 * destructuring (Gauge, Sparkline — RM-191), so a rename never changes what an unset prop
 * reads. Same rows, same once-per-name development warning as `useResolvedChartProps`.
 *
 * Temporary: it goes away once Gauge and Sparkline take their defaults from their
 * definitions and call `useResolvedChartProps` like every other family.
 */
export function useRenamedChartProps<Props extends object>(
  def: AnyComponentDefinition,
  rawProps: Props,
): Props {
  return useMemo(() => renameChartProps(def, rawProps), [def, rawProps]);
}
