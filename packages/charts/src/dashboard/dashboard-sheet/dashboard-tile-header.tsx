"use client";

import { forwardRef, type HTMLAttributes } from "react";
import { cn } from "@elabs-ai/components-ui";

import type { ChartDensity } from "../../charts/chart-config-context";

export interface DashboardTileHeaderProps extends Omit<HTMLAttributes<HTMLDivElement>, "title"> {
  /** Id of the title element; the tile root is labelled by it. */
  titleId: string;
  title: string;
  subtitle?: string;
  /** `xs` hides the subtitle; `xs`/`sm` clamp the title to one line. */
  density: ChartDensity;
  /** The title is a stand-in for a missing one (edit mode): muted, so it reads as a prompt. */
  placeholder?: boolean;
}

/**
 * The tile's title and subtitle. Rendered into `ChartFrame`'s `headerSlot`, so a tile has
 * exactly one header whether or not its body is a frame.
 */
export const DashboardTileHeader = forwardRef<HTMLDivElement, DashboardTileHeaderProps>(
  function DashboardTileHeader(
    { titleId, title, subtitle, density, placeholder = false, className, ...props },
    ref,
  ) {
    const compact = density === "xs" || density === "sm";
    return (
      <div
        ref={ref}
        data-slot="dashboard-tile-header"
        className={cn("min-w-0 space-y-0.5", className)}
        {...props}
      >
        <h3
          id={titleId}
          data-slot="dashboard-tile-header-title"
          data-placeholder={placeholder ? "" : undefined}
          className={cn(
            "text-subtitle",
            placeholder ? "text-muted-foreground" : "text-foreground",
            compact ? "truncate" : "line-clamp-2",
          )}
        >
          {title}
        </h3>
        {subtitle && density !== "xs" ? (
          <p
            data-slot="dashboard-tile-header-subtitle"
            className="truncate text-caption text-muted-foreground"
          >
            {subtitle}
          </p>
        ) : null}
      </div>
    );
  },
);
