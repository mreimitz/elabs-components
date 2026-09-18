"use client";

import type { ReactNode } from "react";
import { useLayoutEffect, useRef } from "react";
import { cn } from "@elabs-ai/components-ui/lib/cn";

export interface ChatShellProps {
  /** Scrollable transcript — typically a <Conversation>. */
  children: ReactNode;
  /**
   * Floating composer — typically a <Composer> (the standard chat input). It
   * floats, padded, over the bottom of the transcript, centred at
   * `--chat-composer-column` (default `--container-3xl`) under a transcript
   * column of `--chat-column` (default `--container-4xl`, read by
   * `ConversationContent`); turns scroll up behind it and fade out.
   */
  composer?: ReactNode;
  /** Optional header row (title, model picker, actions). */
  header?: ReactNode;
  /** Optional right-side context rail (sources, files, memory). */
  aside?: ReactNode;
  /**
   * Frame treatment (the transcript/composer layout is the same in both):
   * - `"card"` (default) — a self-contained rounded, bordered chat card with a
   *   divider under the header. Use when the shell sits on a page among other
   *   content and needs its own frame.
   * - `"bare"` — an immersive pane that fills its container with NO frame and
   *   no header divider. Use when the shell already lives inside a bounded
   *   region (an AppShell `SidebarInset`, a full-page workspace) so it doesn't
   *   draw a redundant second frame.
   */
  variant?: "card" | "bare";
  className?: string;
}

/**
 * Layout shell for an AI chat built from the AI Elements: a header, a
 * full-height scrollable transcript (give it a <Conversation>, which is
 * `flex-1`), a composer floating over the transcript's bottom edge (a
 * <Composer>, the standard chat input), and an optional context rail. Fills
 * its parent's height.
 *
 * Two frames (`variant`): a framed `"card"` for in-page use, and a frameless
 * `"bare"` immersive pane for when the shell already sits inside a bounded
 * region and a second frame would just read as boxy.
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
  const rootRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLDivElement>(null);
  const hasComposer = composer != null;

  // The composer floats OVER the transcript, so the transcript has to
  // know how tall it is — `ConversationContent` pads its bottom by
  // `--chat-composer-inset` (so the last turn scrolls clear of the composer)
  // and `ConversationScrollButton` sits just above it. Written straight onto
  // the root's style: no React state, no re-render per resize.
  useLayoutEffect(() => {
    const root = rootRef.current;
    const node = composerRef.current;
    if (!root) return;
    if (!node) {
      root.style.removeProperty("--chat-composer-inset");
      return;
    }
    const sync = () =>
      root.style.setProperty("--chat-composer-inset", `${node.getBoundingClientRect().height}px`);
    sync();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(sync);
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasComposer]);

  return (
    <div
      ref={rootRef}
      data-slot="chat-shell"
      data-variant={variant}
      className={cn(
        // Reading columns: the transcript (`ConversationContent`) reads a
        // little wider than the composer beneath it. Override per app, e.g.
        // `className="[--chat-column:var(--container-5xl)]"`.
        "flex h-full min-h-0 w-full overflow-hidden bg-background [--chat-column:var(--container-4xl)] [--chat-composer-column:var(--container-3xl)]",
        bare ? null : "rounded-xl border",
        className,
      )}
    >
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        {header ? (
          <div className={cn("flex h-header shrink-0 items-center px-4", bare ? null : "border-b")}>
            {header}
          </div>
        ) : null}

        {/* The transcript runs the FULL height of the pane and the composer
            floats over its bottom edge, so turns scroll up behind the composer
            and dissolve under the top edge instead of stopping at a hard bar.
            The scrims are token-driven (`from-background`) so they fade to the
            shell's own ground in every theme, and inert (`pointer-events-none`
            + `aria-hidden`) so they never block scroll, steal a tap, or get
            announced. */}
        <div className="relative flex min-h-0 flex-1 flex-col">
          {children}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 z-10 h-8 bg-gradient-to-b from-background to-transparent"
          />
          <div
            aria-hidden
            data-slot="chat-shell-scrim"
            // Solid under the composer, fading out a little above it.
            className="pointer-events-none absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-background from-50% to-transparent"
            style={{ height: "calc(var(--chat-composer-inset, 0px) + 3rem)" }}
          />
          {composer ? (
            // The float layer passes pointer events through, so the
            // transcript's scrollbar and the gutters beside the composer stay
            // live; only the composer itself takes input. DOM order still puts
            // it after the transcript (tab order follows reading order).
            <div
              ref={composerRef}
              data-slot="chat-shell-composer"
              className="pointer-events-none absolute inset-x-0 bottom-0 z-20 px-4 pb-4"
            >
              <div className="pointer-events-auto mx-auto w-full max-w-(--chat-composer-column)">
                {composer}
              </div>
            </div>
          ) : null}
        </div>
      </div>
      {aside ? <div className="hidden w-80 shrink-0 border-s lg:block">{aside}</div> : null}
    </div>
  );
}
