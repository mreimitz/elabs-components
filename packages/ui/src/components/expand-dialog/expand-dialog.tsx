"use client";

import { cva, type VariantProps } from "class-variance-authority";
import {
  type ComponentPropsWithoutRef,
  type CSSProperties,
  type ElementRef,
  forwardRef,
  type HTMLAttributes,
  type ReactNode,
} from "react";
import { cn } from "../../lib/cn";
import { DialogBody, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "../dialog";
import { useLocale } from "../locale-provider";

/**
 * ExpandDialog — the one "make this bigger" modal: enlarged content on the
 * inline-start, its context on the inline-end.
 *
 * The shape was invented inside `@qlik-coe-emea/qlabs-components-charts`'
 * `ChartFrame` (chart left, data summary right) and then hand-rolled a second
 * and third time — a chat lightbox, an in-place CSS breakout in a consuming
 * app — because it was trapped in a package the other surfaces cannot import.
 * It lives here so every "expand" affordance in the system opens the SAME
 * two-pane surface: a chart, a table, an image, a document.
 *
 * It is a LAYOUT, not a viewer. What goes in each pane is the caller's
 * business; this component owns the dialog anatomy, the pane geometry, the
 * scroll ownership and the region labelling.
 */

/**
 * The panes grid.
 *
 * `detailPlacement` picks the axis; `stackBelow` re-runs the same decision at a
 * breakpoint, because a 2.5fr/1fr split on a 375px viewport leaves the detail
 * pane about 107px wide — technically present, practically unreadable. The 2×4
 * compound matrix mirrors `cardDetailVariants` (`card.tsx`) so the two
 * detail-panel surfaces in this package resolve their tracks the same way.
 *
 * Track sizes arrive as CSS custom properties (`--expand-dialog-view-size` /
 * `--expand-dialog-detail-size`) rather than arbitrary-value classes, because a
 * runtime string cannot be a Tailwind class — the same technique `Card` uses
 * for `--card-detail-size`. The one pair of properties drives whichever axis is
 * active: columns when the detail is beside, rows when it is below.
 */
export const expandDialogPanesVariants = cva("grid min-h-0 gap-3 overflow-hidden", {
  variants: {
    detailPlacement: { side: "", bottom: "" },
    /**
     * Below this breakpoint the panes stack, whatever `detailPlacement` says.
     * A no-op (documented, not an impossible state) when the detail is already
     * placed at the bottom.
     */
    stackBelow: { never: "", sm: "", md: "", lg: "" },
  },
  compoundVariants: [
    {
      detailPlacement: "side",
      stackBelow: "never",
      class:
        "grid-cols-[var(--expand-dialog-view-size)_var(--expand-dialog-detail-size)] grid-rows-[minmax(0,1fr)]",
    },
    {
      detailPlacement: "side",
      stackBelow: "sm",
      class:
        "grid-rows-[var(--expand-dialog-view-size)_var(--expand-dialog-detail-size)] sm:grid-cols-[var(--expand-dialog-view-size)_var(--expand-dialog-detail-size)] sm:grid-rows-[minmax(0,1fr)]",
    },
    {
      detailPlacement: "side",
      stackBelow: "md",
      class:
        "grid-rows-[var(--expand-dialog-view-size)_var(--expand-dialog-detail-size)] md:grid-cols-[var(--expand-dialog-view-size)_var(--expand-dialog-detail-size)] md:grid-rows-[minmax(0,1fr)]",
    },
    {
      detailPlacement: "side",
      stackBelow: "lg",
      class:
        "grid-rows-[var(--expand-dialog-view-size)_var(--expand-dialog-detail-size)] lg:grid-cols-[var(--expand-dialog-view-size)_var(--expand-dialog-detail-size)] lg:grid-rows-[minmax(0,1fr)]",
    },
    {
      detailPlacement: "bottom",
      stackBelow: "never",
      class: "grid-rows-[var(--expand-dialog-view-size)_var(--expand-dialog-detail-size)]",
    },
    {
      detailPlacement: "bottom",
      stackBelow: "sm",
      class: "grid-rows-[var(--expand-dialog-view-size)_var(--expand-dialog-detail-size)]",
    },
    {
      detailPlacement: "bottom",
      stackBelow: "md",
      class: "grid-rows-[var(--expand-dialog-view-size)_var(--expand-dialog-detail-size)]",
    },
    {
      detailPlacement: "bottom",
      stackBelow: "lg",
      class: "grid-rows-[var(--expand-dialog-view-size)_var(--expand-dialog-detail-size)]",
    },
  ],
  defaultVariants: { detailPlacement: "side", stackBelow: "never" },
});

/**
 * A scrollable pane.
 *
 * `tabIndex ?? 0` follows `DialogBody`'s shipped precedent: a scroll container
 * has to be keyboard-operable (WCAG 2.1.1, axe `scrollable-region-focusable`),
 * and a pane holding only text has no focusable child to scroll from. Pass
 * `tabIndex={-1}` when the pane always contains its own focusable content.
 */
const paneClass =
  "min-h-0 min-w-0 overflow-auto overscroll-contain focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export interface ExpandDialogPanesProps
  extends
    Omit<HTMLAttributes<HTMLDivElement>, "children">,
    VariantProps<typeof expandDialogPanesVariants> {
  /** The enlarged content — the reason the dialog opened. */
  children: ReactNode;
  /**
   * Context for what is in the view pane. Omit for a single-pane dialog: the
   * grid then renders one full-width track and no region wrapper at all.
   */
  detail?: ReactNode;
  /** Accessible name for the detail region. @default `t("ui.expandDialog.detail")` */
  detailLabel?: string;
  /** View track size (any CSS length). @default `"minmax(0, 2.5fr)"` */
  viewSize?: string;
  /** Detail track size (any CSS length). @default `"minmax(0, 1fr)"` */
  detailSize?: string;
  /** Class on the view pane. */
  viewClassName?: string;
  /** Class on the detail pane. */
  detailClassName?: string;
  /** Tab index for the view pane. Pass `-1` when it owns focusable content. */
  viewTabIndex?: number;
  /** Tab index for the detail pane. Pass `-1` when it owns focusable content. */
  detailTabIndex?: number;
}

/**
 * The two-pane body. Usable on its own for a headerless surface (an image
 * lightbox), or via `ExpandDialog`, which supplies the dialog around it.
 */
export const ExpandDialogPanes = forwardRef<HTMLDivElement, ExpandDialogPanesProps>(
  function ExpandDialogPanes(
    {
      children,
      className,
      detail,
      detailClassName,
      detailLabel,
      detailPlacement = "side",
      detailSize = "minmax(0, 1fr)",
      detailTabIndex,
      stackBelow = "never",
      style,
      viewClassName,
      viewSize = "minmax(0, 2.5fr)",
      viewTabIndex,
      ...props
    },
    ref,
  ) {
    const { t } = useLocale();

    /*
     * The raised view floats on the recessed dialog field — structure by ground
     * offset plus elevation rather than a border, so it survives a theme swap
     * and the shadowless decoration dial (`shadow-ring-md` bakes the hairline
     * into the shadow's last layer, so nothing gains a second crisp stroke).
     */
    const view = (
      <div
        data-slot="expand-dialog-view"
        tabIndex={viewTabIndex ?? 0}
        className={cn(paneClass, "rounded-lg bg-card p-4 shadow-ring-md", viewClassName)}
      >
        {children}
      </div>
    );

    // No detail → a single full-width track. Mirrors `Card`'s `detail == null`
    // path: the optional pane costs nothing when it is not asked for.
    if (detail == null) {
      return (
        <div
          ref={ref}
          data-slot="expand-dialog-panes"
          className={cn("grid min-h-0 grid-rows-[minmax(0,1fr)] overflow-hidden", className)}
          style={style}
          {...props}
        >
          {view}
        </div>
      );
    }

    return (
      <div
        ref={ref}
        data-slot="expand-dialog-panes"
        className={cn(expandDialogPanesVariants({ detailPlacement, stackBelow }), className)}
        style={
          {
            "--expand-dialog-view-size": viewSize,
            "--expand-dialog-detail-size": detailSize,
            ...style,
          } as CSSProperties
        }
        {...props}
      >
        {view}
        <div
          data-slot="expand-dialog-detail"
          role="region"
          aria-label={detailLabel ?? t("ui.expandDialog.detail")}
          tabIndex={detailTabIndex ?? 0}
          className={cn(paneClass, detailClassName)}
        >
          {detail}
        </div>
      </div>
    );
  },
);

export interface ExpandDialogHeaderProps extends Omit<HTMLAttributes<HTMLDivElement>, "title"> {
  /** Names the dialog. Rendered as the `<h2>` Radix labels the dialog by. */
  title: ReactNode;
  /** One line of supporting context under the title. */
  description?: ReactNode;
  /** Controls aligned to the inline end of the title row. */
  actions?: ReactNode;
}

/**
 * The dialog's title row.
 *
 * `pe-12` is load-bearing: Radix positions the close button absolutely in the
 * top inline-end corner, so without the padding a long title runs underneath
 * it.
 */
// Not `forwardRef`: it renders `DialogHeader`, which is a plain function
// component with no ref to forward (the base slot stays `dialog-header`).
export function ExpandDialogHeader({
  actions,
  className,
  description,
  title,
  ...props
}: ExpandDialogHeaderProps) {
  return (
    <DialogHeader className={cn("shrink-0 border-b px-6 py-4 pe-12", className)} {...props}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1.5">
          <DialogTitle className="truncate">{title}</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : null}
        </div>
        {actions ? <div className="flex shrink-0 items-center gap-1">{actions}</div> : null}
      </div>
    </DialogHeader>
  );
}

export type ExpandDialogContentProps = ComponentPropsWithoutRef<typeof DialogContent>;

/**
 * The full-bleed content box every expand surface uses.
 *
 * `size="full"` plus a `DialogBody` child puts `DialogContent` into its
 * fixed-header regime (a 3-row grid, header pinned, body owning the scroll) —
 * the anatomy IS the switch, so nothing here hand-rolls a flex column.
 */
export const ExpandDialogContent = forwardRef<
  ElementRef<typeof DialogContent>,
  ExpandDialogContentProps
>(function ExpandDialogContent({ className, ...props }, ref) {
  return <DialogContent ref={ref} size="full" className={cn("p-0", className)} {...props} />;
});

export interface ExpandDialogProps
  extends
    Omit<ExpandDialogContentProps, "title" | "children">,
    Pick<ExpandDialogHeaderProps, "title" | "description" | "actions">,
    Pick<
      ExpandDialogPanesProps,
      | "children"
      | "detail"
      | "detailClassName"
      | "detailLabel"
      | "detailPlacement"
      | "detailSize"
      | "detailTabIndex"
      | "stackBelow"
      | "viewClassName"
      | "viewSize"
      | "viewTabIndex"
    > {
  /** Class on the panes grid. */
  panesClassName?: string;
  /** Class on the recessed field the panes sit in. */
  fieldClassName?: string;
}

/**
 * The batteries-included composition: content box → header → scroll body →
 * panes. Place it inside a `Dialog` you control:
 *
 * ```tsx
 * <Dialog open={open} onOpenChange={setOpen}>
 *   <ExpandDialog title={chart.title} detail={<Summary />}>
 *     <Chart />
 *   </ExpandDialog>
 * </Dialog>
 * ```
 *
 * `Dialog`/`DialogTrigger` are deliberately NOT re-exported under an
 * `ExpandDialog*` name — they would be zero-behaviour aliases, and open state
 * is the consumer's already.
 */
export const ExpandDialog = forwardRef<ElementRef<typeof DialogContent>, ExpandDialogProps>(
  function ExpandDialog(
    {
      actions,
      children,
      className,
      description,
      detail,
      detailClassName,
      detailLabel,
      detailPlacement,
      detailSize,
      detailTabIndex,
      fieldClassName,
      panesClassName,
      stackBelow,
      title,
      viewClassName,
      viewSize,
      viewTabIndex,
      ...props
    },
    ref,
  ) {
    return (
      <ExpandDialogContent
        ref={ref}
        className={className}
        /*
         * With no description the dialog is still named by its title, so opt
         * out of `aria-describedby` explicitly rather than let Radix warn about
         * a missing description.
         */
        {...(description ? {} : { "aria-describedby": undefined })}
        {...props}
      >
        <ExpandDialogHeader actions={actions} description={description} title={title} />
        {/* `tabIndex={-1}`: the panes below are the real scroll owners and take
            their own tab stops, so the body must not add a third. */}
        <DialogBody
          tabIndex={-1}
          className={cn("overflow-hidden bg-background p-3", fieldClassName)}
        >
          <ExpandDialogPanes
            className={cn("h-full", panesClassName)}
            detail={detail}
            detailClassName={detailClassName}
            detailLabel={detailLabel}
            detailPlacement={detailPlacement}
            detailSize={detailSize}
            detailTabIndex={detailTabIndex}
            stackBelow={stackBelow}
            viewClassName={viewClassName}
            viewSize={viewSize}
            viewTabIndex={viewTabIndex}
          >
            {children}
          </ExpandDialogPanes>
        </DialogBody>
      </ExpandDialogContent>
    );
  },
);
