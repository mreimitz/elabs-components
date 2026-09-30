"use client";

import type { CSSProperties, ReactElement, ReactNode, Ref } from "react";
import { ChartA11yLabel } from "./chart-a11y";
import { ChartPlotRoot, type ChartPlotHeight, type Responsive } from "./chart-breakpoint";
import type { Margin } from "./chart-margin";
import { ChartParentSize } from "./chart-parent-size";
import { cn } from "@elabs-ai/components-ui";

/**
 * Shared by `PieChart` and `RingChart`'s root render: both size their inner
 * SVG one of two ways — an explicit `fixedSize`, shrunk by margin with plain
 * JS since nothing measures the DOM, or `ChartParentSize`'s measured content
 * box for responsive sizing — and both wrap either result in the same
 * `ChartPlotRoot` chrome. Each family's own `*ChartInner` differs (radii,
 * seams, labels, …), so it stays a render-prop the caller supplies; this
 * module owns only the branch and the chrome around it.
 */
export interface RadialChartSizingProps {
  /** An explicit width/height in px; unset falls through to `ChartParentSize`. */
  fixedSize?: number;
  /** The resolved margin box (`resolveChartMargin`) — shrinks `fixedSize` by hand. */
  marginBox: Margin;
  /** `marginPaddingStyle(marginBox)` — applied to the responsive branch's root. */
  marginStyle: CSSProperties | undefined;
  plotHeight?: Responsive<ChartPlotHeight>;
  className?: string;
  ariaDescribedby?: string;
  ariaLabel?: string;
  descId: string;
  description?: string;
  innerRef: Ref<HTMLDivElement>;
  role?: string;
  tabIndex?: number;
  /**
   * Loading/empty UI (`StatePanel`) — when set, it replaces `children(size)`
   * in the fixed branch and `<ChartParentSize>` entirely in the responsive
   * branch, so a `status` flip between `"loading"`/empty and `"ready"` keeps
   * rendering through this SAME `<ChartPlotRoot>` call site instead of two
   * different element trees. Reconciliation keys a child by type+position:
   * a caller that returns `<ChartPlotRoot>{statePanel}</ChartPlotRoot>` on
   * one render and a *different* `<ChartPlotRoot>` element (its own JSX call
   * site, own child shape) on the next forces React to unmount the first and
   * mount the second — a focused root loses focus, and every ref callback
   * fires `null` then the new node instead of never firing at all.
   */
  statePanel?: ReactNode;
  /** Renders the family's own `*ChartInner` at the resolved `width`/`height`. */
  children: (size: { width: number; height: number }) => ReactNode;
}

export function RadialChartSizing({
  fixedSize,
  marginBox,
  marginStyle,
  plotHeight,
  className,
  ariaDescribedby,
  ariaLabel,
  descId,
  description,
  innerRef,
  role,
  tabIndex,
  statePanel,
  children,
}: RadialChartSizingProps): ReactElement {
  if (fixedSize) {
    const plotWidth = fixedSize - marginBox.left - marginBox.right;
    const plotHeightPx = fixedSize - marginBox.top - marginBox.bottom;
    return (
      <ChartPlotRoot
        aria-describedby={ariaDescribedby}
        aria-label={ariaLabel}
        className={cn("relative flex items-center justify-center", className)}
        ref={innerRef}
        role={role}
        style={{ width: fixedSize, height: fixedSize, ...marginStyle }}
        tabIndex={tabIndex}
      >
        <ChartA11yLabel descId={descId} description={description} />
        {statePanel ?? children({ width: plotWidth, height: plotHeightPx })}
      </ChartPlotRoot>
    );
  }

  return (
    <ChartPlotRoot
      plotBox={{ plotHeight, defaultPlotHeight: { aspect: 1 } }}
      aria-describedby={ariaDescribedby}
      aria-label={ariaLabel}
      className={cn("relative w-full", className)}
      ref={innerRef}
      role={role}
      style={marginStyle}
      tabIndex={tabIndex}
    >
      <ChartA11yLabel descId={descId} description={description} />
      {statePanel ?? (
        <ChartParentSize>{({ width, height }) => children({ width, height })}</ChartParentSize>
      )}
    </ChartPlotRoot>
  );
}
