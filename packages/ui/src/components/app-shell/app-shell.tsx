import { type ReactNode } from "react";
import { cn } from "../../lib/cn";
import { SkipLink } from "../skip-link";

export interface AppShellProps {
  /** Persistent left navigation (often a <Sidebar />). */
  sidebar?: ReactNode;
  /** Top bar (often a <TopNav />). */
  topNav?: ReactNode;
  children: ReactNode;
  className?: string;
  /** Class for the scrolling main content region. */
  mainClassName?: string;
  /**
   * The `<main>` region's id, and the skip link's target. Override it when a
   * page mounts more than one shell — two elements sharing `main-content`
   * would make the skip link ambiguous. @default "main-content"
   */
  mainId?: string;
}

/**
 * App-first layout: fixed-height viewport with an optional sidebar, a top bar,
 * and a scrollable main region. Pure layout — bring your own nav components.
 */
export function AppShell({
  sidebar,
  topNav,
  children,
  className,
  mainClassName,
  mainId = "main-content",
}: AppShellProps) {
  return (
    <div
      className={cn("flex h-dvh w-full overflow-hidden bg-background text-foreground", className)}
    >
      {/* The first focusable element of the shell, so a keyboard user can pass
          the nav rail instead of tabbing through it on every route (WCAG 2.4.1).
          All four registry app-shell blocks ship one; the primitive they sit
          beside must not be the exception, and it is the surface with the widest
          reach — it is imported, not copy-owned. */}
      <SkipLink targetId={mainId} />
      {sidebar ? <div className="hidden md:flex">{sidebar}</div> : null}
      <div className="flex min-w-0 flex-1 flex-col">
        {topNav}
        {/* `<main>` IS the scroll port here (in the blocks the skip target and
            the scroll port are separate elements), so it takes `tabIndex={0}`
            rather than `{-1}`: a region that scrolls has to be keyboard-operable
            even when the content inside it is not focusable (WCAG 2.1.1, axe
            `scrollable-region-focusable`). `focus-ring-inset`, not `focus-ring`
            — the root above carries `overflow-hidden`, which clips both layers
            of the plain rung. */}
        <main
          id={mainId}
          tabIndex={0}
          className={cn("min-h-0 flex-1 overflow-y-auto focus-ring-inset", mainClassName)}
        >
          {children}
        </main>
      </div>
    </div>
  );
}
