"use client";

import { memo, type ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import { cn } from "@elabs-ai/components-ui";
import type { ChartBrushSelection } from "./chart-brush";
import { resolveDataXExtent } from "./filter-data-by-x-domain";

export interface ChartBrushLayoutState {
  xDomain: [Date, Date] | undefined;
  xDomainSlotCount: number | undefined;
  brushSelection: ChartBrushSelection | null;
  onBrushSelectionChange: (selection: ChartBrushSelection | null) => void;
}

export interface ChartBrushLayoutProps {
  /** Full dataset backing the brush strip and main chart. */
  data: Record<string, unknown>[];
  xDataKey?: string;
  /** When false, children render without brush zoom state. */
  enabled: boolean;
  /** Fixed height of the brush strip in pixels. */
  height: number;
  className?: string;
  children: (layout: ChartBrushLayoutState) => ReactNode;
  /** Mini chart + brush handles rendered below the main chart when `enabled`. */
  brushStrip?: (layout: ChartBrushLayoutState) => ReactNode;
}

function createXAccessor(xDataKey: string) {
  return (d: Record<string, unknown>): Date => {
    const value = d[xDataKey];
    return value instanceof Date ? value : new Date(value as string | number);
  };
}

/**
 * A render-prop seam that stacks a brush strip under a chart.
 *
 * @deprecated Use the navigator instead (RM-140, ADR 0040 §2): pass
 * `scrollbar="miniChart"` (or `window` / `defaultWindow` / `onWindowChange`) to
 * `LineChart`, `AreaChart`, `ComposedChart` or `CandlestickChart` — the shell
 * then owns the window, feeds `xDomain` / `xDomainSlotCount` and mounts
 * `ChartNavigator` below the plot, with keyboard-operable handles. For a strip
 * of your own, render `ChartNavigator` directly. `ChartBrushLayout` keeps
 * working until its removal in 6.0; `ChartBrush` stays the in-plot zoom gesture.
 */
export const ChartBrushLayout = memo(function ChartBrushLayout({
  data,
  xDataKey = "date",
  enabled,
  height,
  className,
  children,
  brushStrip,
}: ChartBrushLayoutProps) {
  const xAccessor = useMemo(() => createXAccessor(xDataKey), [xDataKey]);
  const fullExtent = useMemo(() => resolveDataXExtent(data, xAccessor), [data, xAccessor]);
  const [brushSelection, setBrushSelection] = useState<ChartBrushSelection | null>(null);

  useEffect(() => {
    if (!fullExtent) {
      setBrushSelection(null);
      return;
    }
    setBrushSelection({ start: fullExtent[0], end: fullExtent[1] });
  }, [fullExtent]);

  const handleBrushSelectionChange = useCallback(
    (selection: ChartBrushSelection | null) => {
      if (!selection) {
        if (fullExtent) {
          setBrushSelection({ start: fullExtent[0], end: fullExtent[1] });
        }
        return;
      }
      setBrushSelection(selection);
    },
    [fullExtent],
  );

  const layoutState = useMemo<ChartBrushLayoutState>(
    () => ({
      xDomain:
        enabled && brushSelection
          ? ([brushSelection.start, brushSelection.end] as [Date, Date])
          : undefined,
      xDomainSlotCount: enabled ? data.length : undefined,
      brushSelection,
      onBrushSelectionChange: handleBrushSelectionChange,
    }),
    [brushSelection, data.length, enabled, handleBrushSelectionChange],
  );

  return (
    <div className={cn("flex size-full min-h-0 min-w-0 flex-col gap-3", className)}>
      <div className="min-h-0 min-w-0 flex-1">{children(layoutState)}</div>
      {enabled && brushStrip ? (
        <div className="min-h-0 shrink-0" style={{ height }}>
          {brushStrip(layoutState)}
        </div>
      ) : null}
    </div>
  );
});
