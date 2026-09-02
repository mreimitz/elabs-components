"use client";

import { cn } from "@elabs-ai/components-ui/lib/cn";
import type { HTMLAttributes } from "react";
import { createContext, forwardRef } from "react";

/**
 * TerminalConsole — the console **frame** (ADR 0033,
 * `docs/ADR/0033-terminal-console-frame-and-regions.md`).
 *
 * The agent-session family's twelve components were each correct in
 * isolation and the assembled screen was not: `TerminalSurface`,
 * `TerminalComposer`, `TerminalBanner` and `TerminalPermission` all root on
 * `TerminalSurface`, so a screen using more than one drew its own
 * `rounded-lg border … shadow-sm` with a strip of page background between
 * them, and `TerminalStatusBar` — a `border-t` and nothing else — hung
 * underneath like a page footer. Three nouns fix that, permanently:
 *
 * - **frame** — the console window. Exactly one per console. `TerminalConsole`
 *   IS the frame: it draws the edge, radius, ground and elevation once.
 * - **region** — a transcript, a banner, a permission prompt, a composer, a
 *   status bar. Draws its own padding and content and never a radius, a
 *   shadow, a ground or an outer border.
 * - **seam** — the boundary between two adjacent regions: a single
 *   `border-t border-terminal-border`, owned by the frame
 *   (`[&>*+*]:border-t`) so there is never a gap of page background between
 *   two regions.
 *
 * `overflow-hidden` keeps a square region from painting over the frame's
 * rounded corners. `min-h-0` lets the frame shrink inside a flex ancestor
 * without forcing every region's content to make room for its full height.
 *
 * ## Frame-awareness, not a `frame` prop
 *
 * `TerminalConsole` publishes a second, STATIC context — "a frame exists
 * above me" — that `TerminalSurface` reads. That is what turns
 * `TerminalComposer`, `TerminalBanner` and `TerminalPermission` into regions
 * the moment they sit inside a `TerminalConsole`, with no edit and no new
 * prop of their own (all three root on `TerminalSurface`). A `frame="none"`
 * prop was considered and rejected (ADR 0033, Alternative 2): where an
 * element sits is not a visual axis a caller should have to restate at every
 * call site.
 *
 * A lone `TerminalSurface` on a page is itself a frame — this component is
 * strictly ADDITIVE, so every existing standalone story is unchanged.
 *
 * ## What this component deliberately does NOT do
 *
 * It holds no transcript, runs no timer, owns no scroll container and
 * publishes no `variant` — a `variant` on the console would be a second
 * provider for a value `TerminalSurface` already publishes. It is
 * deliberately thin: frame classes, a flex column, the seam rule, the clip,
 * and one static boolean. Nothing else may ever be added here — see
 * `.claude/rules/terminal-components.md` § "The console is ONE frame", which
 * binds this context to the same prohibition as `TerminalSurface`'s
 * `variant` context.
 */

/**
 * Published to every region beneath a `TerminalConsole`. `false` (the
 * default) means "no frame above me" — a `TerminalSurface` with nothing
 * above it stays a frame in its own right. `TerminalSurface` is the only
 * reader; nothing else in this package needs it, because `TerminalComposer`,
 * `TerminalBanner` and `TerminalPermission` all root on `TerminalSurface`.
 */
export const TerminalFrameContext = createContext(false);

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface TerminalConsoleProps extends HTMLAttributes<HTMLDivElement> {}

export const TerminalConsole = forwardRef<HTMLDivElement, TerminalConsoleProps>(
  function TerminalConsole({ className, children, ...props }, ref) {
    return (
      <div
        ref={ref}
        data-slot="terminal-console"
        className={cn(
          // The frame: exactly one edge, one radius, one ground, one lift
          // for the whole console — never repeated on a region inside it.
          "rounded-lg border border-terminal-border bg-terminal-background text-terminal-foreground",
          "shadow-sm text-code font-mono",
          "flex min-h-0 flex-col overflow-hidden",
          // The seam: the ONLY separation gesture between adjacent regions.
          "[&>*+*]:border-t [&>*+*]:border-terminal-border",
          className,
        )}
        {...props}
      >
        <TerminalFrameContext value={true}>{children}</TerminalFrameContext>
      </div>
    );
  },
);

TerminalConsole.displayName = "TerminalConsole";
