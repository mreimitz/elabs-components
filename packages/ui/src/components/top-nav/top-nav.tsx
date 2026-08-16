import { forwardRef, type HTMLAttributes, type ReactNode } from "react";
import { cn } from "../../lib/cn";

export interface TopNavProps extends HTMLAttributes<HTMLElement> {
  /** Left slot (brand on mobile, breadcrumbs, title). */
  start?: ReactNode;
  /** Right slot (search, actions, account menu). */
  end?: ReactNode;
}

/** Application top bar. Sticky, single row, brand-neutral. */
export const TopNav = forwardRef<HTMLElement, TopNavProps>(function TopNav(
  { className, start, end, children, ...props },
  ref,
) {
  return (
    <header
      ref={ref}
      className={cn(
        "sticky top-0 z-30 flex h-14 items-center gap-4 border-b bg-surface-elevated/80 px-4 backdrop-blur",
        className,
      )}
      {...props}
    >
      {start ? <div className="flex items-center gap-2">{start}</div> : null}
      {children ? (
        <div className="flex flex-1 items-center">{children}</div>
      ) : (
        <div className="flex-1" />
      )}
      {end ? <div className="flex items-center gap-2">{end}</div> : null}
    </header>
  );
});
