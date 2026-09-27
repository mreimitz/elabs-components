"use client";

import { motion } from "motion/react";
import { ShimmeringText } from "./shimmering-text";
import { cn } from "@elabs-ai/components-ui";
import { useChartTranslate } from "./chart-messages";
import {
  LINE_LOADING_PULSE_EASE,
  LOADING_LABEL_EXIT_S,
  LOADING_LABEL_EXIT_Y_PX,
} from "./line-loading-timing";

export interface ChartLoadingLabelProps {
  /** Label shown centered over the chart. */
  text?: string;
  className?: string;
  /** Animate down, fade, and blur during loading → ready handoff. */
  exiting?: boolean;
}

export function ChartLoadingLabel({
  text = "Loading",
  className,
  exiting = false,
}: ChartLoadingLabelProps) {
  if (!text.trim()) {
    return null;
  }

  return (
    <motion.div
      animate={{
        y: exiting ? LOADING_LABEL_EXIT_Y_PX : 0,
        opacity: exiting ? 0 : 1,
        filter: exiting ? "blur(2px)" : "blur(0px)",
      }}
      aria-live="polite"
      className={cn(
        "pointer-events-none absolute inset-0 flex items-center justify-center",
        className,
      )}
      initial={false}
      role="status"
      transition={{
        duration: LOADING_LABEL_EXIT_S,
        ease: [...LINE_LOADING_PULSE_EASE],
      }}
    >
      <ShimmeringText
        className="font-medium text-sm tracking-wide [--color:var(--muted-foreground)] [--shimmering-color:var(--foreground)]"
        text={text}
      />
    </motion.div>
  );
}

/**
 * The default loading announcement of a family whose visible label is opt-in
 * (`loadingLabel` on Line, Area, Composed and Bar): one polite status region
 * reading `charts.chart.loading`, visually hidden, so nothing on screen
 * changes. Every other family already announces those words through its
 * visible `ChartLoadingLabel`. A caller's non-blank `loadingLabel` renders the
 * visible label instead, which is its own status region. Internal.
 */
export function ChartLoadingAnnouncement() {
  const t = useChartTranslate();
  return (
    <span
      aria-live="polite"
      className="sr-only"
      data-slot="chart-loading-announcement"
      role="status"
    >
      {t("charts.chart.loading")}
    </span>
  );
}

export default ChartLoadingLabel;
