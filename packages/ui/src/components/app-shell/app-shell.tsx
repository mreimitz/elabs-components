import { forwardRef, type ReactNode } from "react";
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
 *
 * The `sidebar` slot is hidden below `md` with no fallback of its own: this
 * shell does not know whether `sidebar` already manages its own responsive
 * behavior. `<Sidebar>` (`../sidebar`) does — it renders as an offcanvas
 * `Sheet` below the mobile breakpoint entirely on its own, through a Radix
 * portal that is unaffected by this wrapper's `hidden md:flex` (a portal
 * mounts into `document.body`, not into this DOM subtree) — pair it with a
 * `<SidebarTrigger>` inside `topNav` for full mobile navigation. Wrapping an
 * arbitrary `sidebar` node in a SECOND, shell-owned `Sheet` here would look
 * like a fix but silently break that exact pattern: a Radix `Sheet`/`Dialog`
 * only mounts its content while open, so `<Sidebar>` would be unmounted
 * (not just hidden) whenever the shell's own drawer is closed — and with it,
 * the very trigger a caller uses to open ITS mobile view. A bare nav node
 * (no built-in responsive behavior of its own) has no such fallback; give it
 * one explicitly, e.g. by rendering a `<Sheet>` alongside `topNav` in the
 * consuming app.
 *
 * The `SidebarProvider` + `Sidebar` + `SidebarTrigger` composition above is
 * regression-locked in `app-shell.test.tsx` at a mobile viewport width: no
 * AppShell code change is needed to reach navigation below `md`, because
 * `SidebarProvider` is a plain React context and is never blocked by this
 * component's internal wrapper `<div>`.
 */
export const AppShell = forwardRef<HTMLDivElement, AppShellProps>(function AppShell(
  { sidebar, topNav, children, className, mainClassName, mainId = "main-content" },
  ref,
) {
  return (
    <div
      ref={ref}
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
});
