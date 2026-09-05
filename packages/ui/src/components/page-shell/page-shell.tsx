import { forwardRef, type ComponentProps, type ReactNode } from "react";
import { cn } from "../../lib/cn";

export interface PageShellProps extends ComponentProps<"div"> {
  children: ReactNode;
  /** Optional header row (often a <SectionHeader />, or a <ViewToolbar> — see headerVariant). */
  header?: ReactNode;
  /**
   * "default" (unset) — `header` renders inline, scrolls with the body.
   * Byte-identical to today.
   *
   * "toolbar" — for a `<ViewToolbar>` header (`@elabs-ai/components-ui`,
   * `Docs/View Toolbar Contract`): wraps `header` in a `sticky top-0` container
   * with an opaque/blurred fill and a bottom hairline, so it stays pinned while
   * the body scrolls beneath it. PLACES whatever node `header` is — it does not
   * reimplement ViewToolbar's own info/left-cluster/actions grammar, and it does
   * NOT cap the row's height (a `<ViewToolbar>` wraps at narrow widths; see
   * `Docs/View Toolbar Contract` R7).
   */
  headerVariant?: "default" | "toolbar";
  /** Constrain content width. Defaults to "xl". */
  width?: "md" | "lg" | "xl" | "full";
  /**
   * "body" (default) — the page scrolls with the document. Byte-identical to
   * the pre-#R6 behaviour; existing callers are unaffected.
   * "content" — this container is the scroll port. Use inside a `SidebarInset`
   * whose height is already bounded, so the top bar stays put. Defaults its own
   * `tabIndex` to `0` (a scroll container must be keyboard-operable — WCAG
   * 2.1.1, axe `scrollable-region-focusable`), following the `DialogBody`
   * precedent; pass `tabIndex={-1}` to opt out when the content already
   * supplies its own focusable child.
   * "fill" — fills its parent and scrolls nothing itself; a child (a table, a
   * canvas) owns the scrolling — and owns that child's keyboard reachability
   * too, the same way.
   */
  scroll?: "body" | "content" | "fill";
  /**
   * Reserve a fixed header row so a page title lands at identical coordinates
   * on every route, whether or not that route has a header. Default `false`.
   *
   * The row's height is a component-local CSS variable —
   * `--page-shell-header-gutter`, declared on the root, default `--spacing(12)`
   * (3rem / 48px at a 16px root — the height a one-line title already occupies
   * inside the `headerVariant="toolbar"` bar's own `py-3`). It is NOT a theme
   * token (`pnpm theme-parity:check` does not see it); retune it per surface the
   * same way `--focus-ring-color` is retargeted elsewhere in this package:
   * `<PageShell headerGutter className="[--page-shell-header-gutter:--spacing(16)]" />`.
   *
   * When `true` the header row renders **even if `header` is omitted** — that
   * empty row is the whole mechanism, and it is what `headerGutter={false}`
   * must never produce.
   */
  headerGutter?: boolean;
  className?: string;
  contentClassName?: string;
}

const widthMap = {
  md: "max-w-3xl",
  lg: "max-w-5xl",
  xl: "max-w-7xl",
  full: "max-w-none",
} as const;

const scrollMap = {
  body: "",
  content: "min-h-0 flex-1 overflow-y-auto",
  fill: "h-full min-h-0 overflow-hidden",
} as const;

/** Page-level content container with consistent padding and max width. */
export const PageShell = forwardRef<HTMLDivElement, PageShellProps>(function PageShell(
  {
    children,
    header,
    headerVariant = "default",
    width = "xl",
    scroll = "body",
    headerGutter = false,
    className,
    contentClassName,
    tabIndex,
    ...props
  },
  ref,
) {
  // scroll="content" makes this element the scroll port, so it needs the same
  // keyboard-operable fix `DialogBody`/`ExpandDialogPanes` ship: default the
  // tab stop to 0, let a caller opt out with an explicit `tabIndex` (typically
  // `-1`). "body"/"fill" never set a default, so their DOM gains no attribute.
  const resolvedTabIndex = tabIndex ?? (scroll === "content" ? 0 : undefined);

  const headerNode = header ? (
    headerVariant === "toolbar" ? (
      <div
        data-slot="page-shell-toolbar-header"
        className="sticky top-0 z-10 border-b border-border bg-background/95 py-3 backdrop-blur"
      >
        {header}
      </div>
    ) : (
      header
    )
  ) : null;

  return (
    <div
      ref={ref}
      data-slot="page-shell"
      tabIndex={resolvedTabIndex}
      className={cn(
        "w-full px-4 py-6 sm:px-6 lg:px-8",
        scrollMap[scroll],
        scroll === "content" && "focus-ring",
        headerGutter && "[--page-shell-header-gutter:--spacing(12)]",
        className,
      )}
      {...props}
    >
      <div
        data-slot="page-shell-content"
        className={cn("mx-auto w-full space-y-6", widthMap[width], contentClassName)}
      >
        {headerGutter ? (
          <div
            data-slot="page-shell-header"
            className="flex min-h-(--page-shell-header-gutter) items-center"
          >
            {headerNode}
          </div>
        ) : (
          headerNode
        )}
        {children}
      </div>
    </div>
  );
});
