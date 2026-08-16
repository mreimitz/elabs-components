"use client";

/**
 * CopyableValue — shown short, copied exact.
 *
 * Numbers across the library are formatted COMPACT by default (`1.5M`, `$820`),
 * because the surfaces they appear on — a KPI tile, an axis tick, a chart in a
 * chat bubble — have no room for `50012102.632741`. That is only defensible if
 * the exact value stays reachable, so this renders the compact string as a real
 * `<button>` that puts the unrounded one on the clipboard.
 *
 * Why a button and not a tooltip: a chart tooltip is `pointer-events-none` (it
 * must not swallow the `mousemove` that drives the crosshair), so it can carry
 * text but never an interaction. A button is reachable by mouse, by keyboard,
 * and by touch — all three, with no bespoke affordance.
 */

import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { cn } from "../../lib/cn";
import { useCopyToClipboard } from "../../lib/use-copy-to-clipboard";
import { useLocale } from "../locale-provider";

export interface CopyableValueProps extends Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "value" | "children"
> {
  /**
   * The EXACT text written to the clipboard — the unrounded, un-abbreviated
   * value. Not locale-formatted by this component: a copied number is usually
   * on its way into a spreadsheet or a query.
   */
  value: string;
  /** What the reader sees. Defaults to `value`. */
  children?: ReactNode;
  /**
   * Overrides the screen-reader hint appended to the visible text. The
   * accessible name is always `<visible text> + <hint>`, which keeps WCAG 2.5.3
   * (Label in Name) satisfied — voice-control users can say what they read.
   */
  hint?: string;
  /** ms the "Copied" confirmation stays. Default: 1500. */
  resetAfterMs?: number;
}

/**
 * A value that copies its exact form on click.
 *
 * ```tsx
 * <CopyableValue value="50012102.632741">50M</CopyableValue>
 * ```
 */
export const CopyableValue = forwardRef<HTMLButtonElement, CopyableValueProps>(
  function CopyableValue(
    { value, children, hint, resetAfterMs, className, onClick, ...props },
    ref,
  ) {
    const { t } = useLocale();
    const { copied, copy } = useCopyToClipboard(
      resetAfterMs === undefined ? undefined : { resetAfterMs },
    );

    return (
      <>
        <button
          data-slot="copyable-value"
          data-copied={copied ? "" : undefined}
          ref={ref}
          type="button"
          {...props}
          className={cn(
            // Reads as text, behaves as a control: the dotted underline is the
            // only resting affordance, so a value inside a heading or a KPI
            // still looks like a value, not a link.
            "inline-flex items-baseline gap-1 rounded-sm underline decoration-dotted decoration-muted-foreground underline-offset-4",
            "hover:decoration-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            "transition-colors duration-fast ease-standard motion-reduce:transition-none",
            className,
          )}
          onClick={(event) => {
            onClick?.(event);
            if (!event.defaultPrevented) {
              void copy(value);
            }
          }}
        >
          {children ?? value}
          <span className="sr-only">{hint ?? t("ui.copyableValue.hint")}</span>
        </button>
        {/*
          One live region per control, always mounted: an `aria-live` region
          inserted at the same moment its text appears is frequently missed by
          screen readers (ARIA22), so the region exists from first paint and
          only its contents change.
        */}
        <span aria-live="polite" className="sr-only" role="status">
          {copied ? t("ui.copyableValue.copied") : ""}
        </span>
      </>
    );
  },
);
