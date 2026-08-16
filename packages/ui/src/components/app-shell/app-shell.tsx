import { type ReactNode } from "react";
import { cn } from "../../lib/cn";

export interface AppShellProps {
  /** Persistent left navigation (often a <Sidebar />). */
  sidebar?: ReactNode;
  /** Top bar (often a <TopNav />). */
  topNav?: ReactNode;
  children: ReactNode;
  className?: string;
  /** Class for the scrolling main content region. */
  mainClassName?: string;
}

/**
 * App-first layout: fixed-height viewport with an optional sidebar, a top bar,
 * and a scrollable main region. Pure layout — bring your own nav components.
 */
export function AppShell({ sidebar, topNav, children, className, mainClassName }: AppShellProps) {
  return (
    <div
      className={cn("flex h-dvh w-full overflow-hidden bg-background text-foreground", className)}
    >
      {sidebar ? <div className="hidden md:flex">{sidebar}</div> : null}
      <div className="flex min-w-0 flex-1 flex-col">
        {topNav}
        <main className={cn("min-h-0 flex-1 overflow-y-auto", mainClassName)}>{children}</main>
      </div>
    </div>
  );
}
