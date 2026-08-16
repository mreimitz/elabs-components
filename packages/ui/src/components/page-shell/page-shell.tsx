import { type ReactNode } from "react";
import { cn } from "../../lib/cn";

export interface PageShellProps {
  children: ReactNode;
  /** Optional header row (often a <SectionHeader />, or a <ViewToolbar> — see headerVariant). */
  header?: ReactNode;
  /**
   * "default" (unset) — `header` renders inline, scrolls with the body.
   * Byte-identical to today.
   *
   * "toolbar" — for a `<ViewToolbar>` header (`@elabs/components-ui`,
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
  className?: string;
  contentClassName?: string;
}

const widthMap = {
  md: "max-w-3xl",
  lg: "max-w-5xl",
  xl: "max-w-7xl",
  full: "max-w-none",
} as const;

/** Page-level content container with consistent padding and max width. */
export function PageShell({
  children,
  header,
  headerVariant = "default",
  width = "xl",
  className,
  contentClassName,
}: PageShellProps) {
  return (
    <div className={cn("w-full px-4 py-6 sm:px-6 lg:px-8", className)}>
      <div className={cn("mx-auto w-full space-y-6", widthMap[width], contentClassName)}>
        {header ? (
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
        ) : null}
        {children}
      </div>
    </div>
  );
}
