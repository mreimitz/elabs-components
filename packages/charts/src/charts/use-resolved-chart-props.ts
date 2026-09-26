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
  applyAliases,
  type NormalizedAliasRow,
  resolveProps,
  type ResolvedProps,
} from "@elabs-ai/components-ui/definition";

import { warnChartOnce } from "./chart-breakpoint";

/** The development warning for a caller still using an old prop name. */
function aliasWarning(id: string, row: NormalizedAliasRow): string {
  return `[${id}] "${row.from}" is deprecated and will be removed in ${row.removeIn}. Use "${row.to}".`;
}

/** `rawProps` with renamed props mapped and the definition's defaults filled in. */
export function useResolvedChartProps<D extends AnyComponentDefinition, Props extends object>(
  def: D,
  rawProps: Props,
): ResolvedProps<Props, D> {
  return useMemo(() => {
    const renamed = applyAliases(def, rawProps, (row) =>
      warnChartOnce(`${def.id}.${row.from}`, aliasWarning(def.id, row)),
    );
    return resolveProps(def, renamed);
  }, [def, rawProps]);
}
