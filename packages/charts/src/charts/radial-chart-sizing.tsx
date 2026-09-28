"use client";

import type { CSSProperties, ReactElement, ReactNode, Ref } from "react";
import { ChartA11yLabel } from "./chart-a11y";
import { ChartPlotRoot, type ChartPlotHeight, type Responsive } from "./chart-breakpoint";
import type { Margin } from "./chart-margin";
import { ChartParentSize } from "./chart-parent-size";
import { cn } from "@elabs-ai/components-ui";

/**
 * Shared by `PieChart` and `RingChart`'s root render (handed on from
 * RM-202): both size their inner SVG one of two ways — an explicit
 * `fixedSize`, shrunk by margin with plain JS since nothing measures the
 * DOM, or `ChartParentSize`'s measured content box for responsive sizing —
 * and both wrap either result in the same `ChartPlotRoot` chrome. Each
 * family's own `*ChartInner` differs (radii, seams, labels, …), so it stays
 * a render-prop the caller supplies; this module owns only the branch and
 * the chrome around it.
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
        {children({ width: plotWidth, height: plotHeightPx })}
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
      <ChartParentSize>{({ width, height }) => children({ width, height })}</ChartParentSize>
    </ChartPlotRoot>
  );
}
