"use client";

/**
 * ChartFrame footer (RM-117) — the Datawrapper footer row:
 * "Chart: Author • Source: Name (linked) • Get the data • Download image".
 *
 * The byline and source are part of the picture (they travel with an export);
 * the action links are controls, so each one is marked
 * `data-chart-export="exclude"` together with its leading separator and the
 * export layer leaves them out.
 */

import { forwardRef, isValidElement, type HTMLAttributes, type ReactNode } from "react";
import { cn } from "@elabs-ai/components-ui";
import {
  useChartFrame,
  type ChartFrameByline,
  type ChartFrameSourceLink,
} from "./chart-frame-context";

/** A footer action: a built-in link, or your own node (an "Embed" link, say). */
export type ChartFrameAction = "data" | "svg" | "png" | ReactNode;

/** Footer words — pass your own to localise them. */
export interface ChartFooterLabels {
  chart: string;
  map: string;
  table: string;
  source: string;
  /** The `"data"` action: downloads the frame's data as CSV. */
  getTheData: string;
  /** The `"png"` action. */
  downloadImage: string;
  /** The `"svg"` action. */
  downloadSvg: string;
}

export const DEFAULT_CHART_FOOTER_LABELS: ChartFooterLabels = {
  chart: "Chart",
  map: "Map",
  table: "Table",
  source: "Source",
  getTheData: "Get the data",
  downloadImage: "Download image",
  downloadSvg: "Download SVG",
};

const SEPARATOR = "•";

/** True for the `{ name, href }` form of `source` (not a React element or a string). */
export function isChartSourceLink(source: unknown): source is ChartFrameSourceLink {
  return (
    typeof source === "object" &&
    source !== null &&
    !isValidElement(source) &&
    !Array.isArray(source) &&
    "name" in source
  );
}

/** Datawrapper order: data first, then your own links (Embed), then image downloads. */
function actionRank(action: ChartFrameAction): number {
  if (action === "data") return 0;
  if (action === "svg") return 2;
  if (action === "png") return 3;
  return 1;
}

export interface ChartFooterProps extends HTMLAttributes<HTMLDivElement> {
  byline?: ChartFrameByline;
  source?: ReactNode | ChartFrameSourceLink;
  actions?: readonly ChartFrameAction[];
  labels?: Partial<ChartFooterLabels>;
}

function Separator() {
  return (
    <span aria-hidden="true" className="px-1">
      {SEPARATOR}
    </span>
  );
}

const linkClass = "rounded-xs underline underline-offset-2 hover:text-chart-foreground focus-ring";

/** The footer row. Renders inside a `ChartFrame` (its actions drive the frame). */
export const ChartFooter = forwardRef<HTMLDivElement, ChartFooterProps>(function ChartFooter(
  { byline, source, actions, labels: labelsProp, className, ...props },
  ref,
) {
  const { state, actions: frameActions, meta } = useChartFrame();
  const labels = { ...DEFAULT_CHART_FOOTER_LABELS, ...labelsProp };

  const items: { id: string; node: ReactNode; exclude: boolean }[] = [];
  if (byline) {
    items.push({
      id: "byline",
      exclude: false,
      node: (
        <span data-slot="chart-frame-byline">
          {labels[byline.kind ?? "chart"]}: {byline.author}
        </span>
      ),
    });
  }
  if (source !== undefined && source !== null && source !== false && source !== "") {
    const link = isChartSourceLink(source) ? source : undefined;
    items.push({
      id: "source",
      exclude: false,
      node: (
        <span data-slot="chart-frame-source">
          {labels.source}:{" "}
          {link?.href ? (
            <a className={linkClass} href={link.href} rel="noreferrer" target="_blank">
              {link.name}
            </a>
          ) : link ? (
            link.name
          ) : (
            (source as ReactNode)
          )}
        </span>
      ),
    });
  }

  const ranked = (actions ?? [])
    .map((action, position) => ({ action, position }))
    .sort((a, b) => actionRank(a.action) - actionRank(b.action) || a.position - b.position);
  for (const { action, position } of ranked) {
    if (action === "data") {
      if (meta.rows.length === 0) continue;
      items.push({
        id: "action-data",
        exclude: true,
        node: (
          <button className={linkClass} type="button" onClick={frameActions.download}>
            {labels.getTheData}
          </button>
        ),
      });
    } else if (action === "svg" || action === "png") {
      if (!state.hasSvg) continue;
      items.push({
        id: `action-${action}`,
        exclude: true,
        node: (
          <button
            className={linkClass}
            type="button"
            onClick={() => (action === "svg" ? frameActions.exportSvg() : frameActions.exportPng())}
          >
            {action === "svg" ? labels.downloadSvg : labels.downloadImage}
          </button>
        ),
      });
    } else if (action !== null && action !== undefined && action !== false) {
      items.push({ id: `action-node-${position}`, exclude: true, node: action });
    }
  }

  if (items.length === 0) return null;

  return (
    <div
      ref={ref}
      data-slot="chart-frame-footer"
      className={cn(
        "flex min-w-0 flex-wrap items-baseline text-meta text-chart-foreground-muted",
        className,
      )}
      {...props}
    >
      {items.map((item, index) => (
        <span
          key={item.id}
          className="inline-flex min-w-0 items-baseline"
          {...(item.exclude ? { "data-chart-export": "exclude" } : {})}
        >
          {index > 0 ? <Separator /> : null}
          {item.node}
        </span>
      ))}
    </div>
  );
});

ChartFooter.displayName = "ChartFooter";
