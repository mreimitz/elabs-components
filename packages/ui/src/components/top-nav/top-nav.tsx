import { forwardRef, type HTMLAttributes, type ReactNode } from "react";
import { cn } from "../../lib/cn";

export interface TopNavProps extends HTMLAttributes<HTMLElement> {
  /** Left slot (brand on mobile, breadcrumbs, title). */
  start?: ReactNode;
  /**
   * Centred slot (e.g. a global search field, or horizontal primary
   * navigation). Laid out as the middle column of a 3-column grid, so it
   * stays visually centred in the bar regardless of how wide `start`/`end`
   * are — plain `flex-1` filler only centres content when both sides are
   * equal width. Passing `center` switches the bar to this grid layout and
   * `children` is ignored (pass everything through `start`/`center`/`end`
   * instead); omit `center` to keep the original `start` / `children` / `end`
   * flex row unchanged.
   */
  center?: ReactNode;
  /** Right slot (search, actions, account menu). */
  end?: ReactNode;
}

/** Application top bar. Sticky, single row, brand-neutral. */
export const TopNav = forwardRef<HTMLElement, TopNavProps>(function TopNav(
  { className, start, center, end, children, ...props },
  ref,
) {
  return (
    <header
      ref={ref}
      className={cn(
        "sticky top-0 z-30 flex h-header items-center gap-4 border-b bg-surface-elevated/80 px-4 backdrop-blur",
        className,
      )}
      {...props}
    >
      {center ? (
        <div className="grid w-full grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-4">
          <div
            data-slot="top-nav-start"
            className="flex min-w-0 items-center justify-self-start gap-2"
          >
            {start}
          </div>
          <div data-slot="top-nav-center" className="flex items-center justify-self-center">
            {center}
          </div>
          <div data-slot="top-nav-end" className="flex min-w-0 items-center justify-self-end gap-2">
            {end}
          </div>
        </div>
      ) : (
        <>
          {start ? <div className="flex items-center gap-2">{start}</div> : null}
          {children ? (
            <div className="flex flex-1 items-center">{children}</div>
          ) : (
            <div className="flex-1" />
          )}
          {end ? <div className="flex items-center gap-2">{end}</div> : null}
        </>
      )}
    </header>
  );
});
