"use client";

import type { ReactNode } from "react";
import { cn } from "@elabs/components-ui/lib/cn";

export interface ChatShellProps {
  /** Scrollable transcript — typically a <Conversation>. */
  children: ReactNode;
  /** Sticky composer — typically a <Composer> (the standard chat input). */
  composer?: ReactNode;
  /** Optional header row (title, model picker, actions). */
  header?: ReactNode;
  /** Optional right-side context rail (sources, files, memory). */
  aside?: ReactNode;
  /**
   * Layout treatment:
   * - `"card"` (default) — a self-contained rounded, bordered chat card. Use
   *   when the shell sits on a page among other content and needs its own frame.
   * - `"bare"` — an immersive pane that fills its container with NO frame: the
   *   transcript fades under the header and above the composer (a token-driven
   *   top/bottom scrim) and the composer floats on the pane background instead
   *   of a hard bordered bar. Use when the shell already lives inside a bounded
   *   region (an AppShell `SidebarInset`, a full-page workspace) so it doesn't
   *   draw a redundant second frame.
   */
  variant?: "card" | "bare";
  className?: string;
}

/**
 * Layout shell for an AI chat built from the AI Elements: a header, a scrollable
 * transcript (give it a <Conversation>, which is `flex-1`), a sticky composer
 * (a <Composer>, the standard chat input), and an optional context rail. Fills
 * its parent's height.
 *
 * Two layout modes (`variant`): a framed `"card"` for in-page use, and a
 * frameless `"bare"` immersive pane for when the shell already sits inside a
 * bounded region and a second frame would just read as boxy.
 */
export function ChatShell({
  children,
  composer,
  header,
  aside,
  variant = "card",
  className,
}: ChatShellProps) {
  const bare = variant === "bare";
  return (
    <div
      className={cn(
        "flex h-full min-h-0 w-full overflow-hidden bg-background",
        bare ? null : "rounded-xl border",
        className,
      )}
    >
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        {header ? (
          <div className={cn("flex h-12 shrink-0 items-center px-4", bare ? null : "border-b")}>
            {header}
          </div>
        ) : null}

        {bare ? (
          // Immersive transcript: the scroll area fades at both edges so content
          // dissolves under the header and above the composer instead of hitting
          // a hard bordered bar. The overlays are token-driven (`from-background`)
          // so they fade to the shell's own ground in every theme, and inert
          // (`pointer-events-none` + `aria-hidden`) so they never block scroll,
          // steal a tap, or get announced.
          <div className="relative flex min-h-0 flex-1 flex-col">
            {children}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-0 top-0 z-10 h-8 bg-gradient-to-b from-background to-transparent"
            />
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-12 bg-gradient-to-t from-background to-transparent"
            />
          </div>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col">{children}</div>
        )}

        {composer ? (
          // Bare: the composer floats on the pane ground (transparent, no
          // divider) above the fade; card: the classic bordered footer.
          <div className={cn("shrink-0", bare ? "relative z-20 px-4 pb-4" : "border-t p-3")}>
            {composer}
          </div>
        ) : null}
      </div>
      {aside ? <div className="hidden w-80 shrink-0 border-s lg:block">{aside}</div> : null}
    </div>
  );
}
