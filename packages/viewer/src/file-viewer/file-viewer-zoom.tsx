"use client";

/**
 * `FileViewerZoom` and `FileViewerRotate` — how big, and which way up.
 *
 * Parts over the provider's view state (ADR 0026), so an app can put the scale
 * control in its own header without reaching inside the canvas.
 *
 * Each renders NOTHING for a format whose manifest does not claim the capability
 * — an inert zoom control over a CSV is chrome with nothing in it, which reads
 * as a broken render (`viewer-components.md`). That absence is also the fix for
 * the `image` manifest's old lie: it declared `zoom` and `rotate` while its
 * renderer implemented neither, so the claim was invisible either way.
 */

import {
  cn,
  IconButton,
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
  useLocale,
} from "@elabs-ai/components-ui";
import { RotateCwIcon, ZoomInIcon, ZoomOutIcon } from "lucide-react";
import { forwardRef, type HTMLAttributes } from "react";

import type { ZoomLevel } from "../core/types";
import { canStepZoom, isZoomFit, VIEWER_ZOOM_STEPS } from "../core/zoom";
import { useFileViewer } from "./file-viewer-context";

export type FileViewerZoomProps = HTMLAttributes<HTMLDivElement>;

/**
 * Zoom out · the current level · zoom in.
 *
 * The middle control is a `Select` rather than a read-out because the stops are
 * the API: a reader who wants 200% should not have to press "+" four times, and
 * the two fit modes have no number to press towards at all.
 *
 * Not a `role="toolbar"` — see `FileViewerPager`. It sits in the same row, and
 * one row that is half roving-tabindex and half ordinary tab stops is worse for
 * a keyboard reader than one that is consistently ordinary.
 */
export const FileViewerZoom = forwardRef<HTMLDivElement, FileViewerZoomProps>(
  function FileViewerZoom({ className, ...props }, ref) {
    const { state, actions } = useFileViewer();
    const { t, formatNumber } = useLocale();

    if (!state.capabilities.zoom) return null;

    const { zoom, effectiveZoom } = state;
    const percent = (scale: number) =>
      formatNumber(scale, { style: "percent", maximumFractionDigits: 0 });

    return (
      <div
        ref={ref}
        data-slot="file-viewer-zoom"
        role="group"
        aria-label={t("viewer.zoom.controls")}
        className={cn("flex shrink-0 items-center gap-1", className)}
        {...props}
      >
        <IconButton
          variant="ghost"
          size="icon-sm"
          label={t("viewer.zoom.out")}
          icon={<ZoomOutIcon aria-hidden="true" />}
          // Stepping is measured against what is ON SCREEN, so a page fitted to
          // 137% still has somewhere to go in both directions.
          disabled={!canStepZoom(effectiveZoom, -1)}
          onClick={actions.zoomOut}
        />
        <Select
          value={zoomToValue(zoom)}
          onValueChange={(value) => actions.setZoom(valueToZoom(value))}
        >
          <SelectTrigger
            size="sm"
            aria-label={t("viewer.zoom.level")}
            className="h-7 w-24 gap-1 px-2"
          >
            {/* Children override the selected item's own text: a fit mode has to
                read as "Fit width", but a fixed stop reads better as the number
                than as a row label, and both have to fit one narrow trigger. */}
            <SelectValue>
              {isZoomFit(zoom)
                ? t(zoom === "fit-width" ? "viewer.zoom.fitWidth" : "viewer.zoom.fitPage")
                : percent(zoom)}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="fit-width">{t("viewer.zoom.fitWidth")}</SelectItem>
            <SelectItem value="fit-page">{t("viewer.zoom.fitPage")}</SelectItem>
            <SelectSeparator />
            {VIEWER_ZOOM_STEPS.map((step) => (
              <SelectItem key={step} value={String(step)}>
                {percent(step)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <IconButton
          variant="ghost"
          size="icon-sm"
          label={t("viewer.zoom.in")}
          icon={<ZoomInIcon aria-hidden="true" />}
          disabled={!canStepZoom(effectiveZoom, 1)}
          onClick={actions.zoomIn}
        />
        {/* One live region for the group: neither a repainted canvas nor a
            `Select`'s own value change announces the new scale. */}
        <span role="status" aria-live="polite" className="sr-only">
          {t("viewer.zoom.status", { level: percent(effectiveZoom) })}
        </span>
      </div>
    );
  },
);

/** `Select` speaks strings; the state is a number or a fit mode. */
function zoomToValue(zoom: ZoomLevel): string {
  return isZoomFit(zoom) ? zoom : String(zoom);
}

function valueToZoom(value: string): ZoomLevel {
  if (value === "fit-width" || value === "fit-page") return value;
  const parsed = Number.parseFloat(value);
  return Number.isNaN(parsed) ? 1 : parsed;
}

export type FileViewerRotateProps = HTMLAttributes<HTMLButtonElement>;

/**
 * One button, one quarter-turn clockwise.
 *
 * Document-level and clockwise-only on purpose: a counter-clockwise button is a
 * second control for something three presses of this one already do, and
 * per-page rotation would change the file, which is authoring rather than
 * viewing. `actions.rotate(-1)` is there for an app that wants the other one.
 */
export const FileViewerRotate = forwardRef<HTMLButtonElement, FileViewerRotateProps>(
  function FileViewerRotate({ className, ...props }, ref) {
    const { state, actions } = useFileViewer();
    const { t } = useLocale();

    if (!state.capabilities.rotate) return null;

    return (
      <IconButton
        ref={ref}
        data-slot="file-viewer-rotate"
        variant="ghost"
        size="icon-sm"
        label={t("viewer.rotate")}
        icon={<RotateCwIcon aria-hidden="true" />}
        className={cn("shrink-0", className)}
        onClick={() => actions.rotate(1)}
        {...props}
      />
    );
  },
);
