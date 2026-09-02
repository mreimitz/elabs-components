"use client";

import { Skeleton, useLocale } from "@elabs-ai/components-ui";
import { cn } from "@elabs-ai/components-ui/lib/cn";
import type { CSSProperties, HTMLAttributes } from "react";
import { createContext, forwardRef, use } from "react";
import { TerminalFrameContext } from "./terminal-console";
import { TerminalRow } from "./terminal-row";

/**
 * TerminalSurface — the console GROUND for the agent-session family (#117).
 *
 * The console-ness of this family is not twelve components; it is **a ground,
 * a type role, and a two-column grid**. `TerminalSurface` establishes all
 * three exactly once — `bg-terminal-background` / `text-terminal-foreground`,
 * `font-mono` + the `code` type role, and the `--terminal-gutter` track — and
 * publishes exactly ONE value (`variant`) through a minimal context. Every row
 * is an independent component that renders a `TerminalRow` grid, reads
 * `variant` from this context, and accepts a `variant` prop that overrides it
 * so the row still works standalone.
 *
 * Two shapes were considered and rejected, recorded so they are not rebuilt:
 *
 * - **A row kit with no shared frame.** Each row would have to restate the
 *   ground, the mono role and the gutter width; a consumer who forgets one
 *   gets monospace widgets floating on `bg-background`, and the gutter
 *   constant gets duplicated once per row component.
 * - **A `TerminalSession` provider owning the transcript.** The state it would
 *   own is largely not ours to own (D5 — we render models, we do not own
 *   them). Row expansion is per-row Radix `Collapsible` state and elapsed time
 *   is a caller-supplied `elapsedMs` prop (the precedent is
 *   `@elabs-ai/components-ai`'s `TurnStatus`, which takes `elapsedMs` rather
 *   than running a timer).
 *
 * The load-bearing difference from "a kit plus a wrapper" is *where alignment
 * lives*. Here the gutter is a property of the SURFACE, expressed as a CSS
 * custom property, and rows are grid children of a track list they do not own.
 * That is the only way to satisfy "no `ch`-based column alignment" while
 * keeping wrapped continuation lines aligned under the content column.
 *
 * ## What this component deliberately does NOT do
 *
 * **It owns no scroll container.** A transcript over ~50 rows must be
 * virtualized by the caller (see `.claude/rules/interaction-guidelines.md`
 * § Performance), and a scroll container in here would fight the caller's
 * virtualizer. Rows are plain elements; the caller supplies the viewport.
 *
 * **It runs no timer, holds no transcript, and fetches nothing.** `loading` is
 * a prop the caller sets, per `.claude/rules/loading-states.md`.
 *
 * ## Frame-awareness (ADR 0033)
 *
 * This surface reads a second, static context published by
 * `{@link TerminalConsole}` — `TerminalFrameContext` — and, when a frame
 * exists above it, OMITS its own frame classes (`rounded-lg border
 * border-terminal-border bg-terminal-background shadow-sm`) and adds
 * `ring-inset`. It never negates them with `rounded-none border-0
 * shadow-none`: a caller who genuinely wants a framed region back adds those
 * classes through `className`, and `cn()` resolves it cleanly. The ground
 * ink, the type role, the gutter track, the `variant` context, the padding
 * and the loading skeletons are unchanged either way — only the frame's own
 * four declarations move. `ring-inset` is load-bearing, not polish: the
 * frame clips (`overflow-hidden`) and `ring-*` is an outset box-shadow, so a
 * region's `focus-within:ring-2` (`TerminalComposer`) would otherwise be cut
 * on three sides. A `TerminalSurface` with nothing above it renders exactly
 * as before — this is additive, not a restyle.
 */

/** The gutter grammar shared by the surface and every row inside it. */
export type TerminalVariant = "marker" | "rail" | "boxed";

export const TERMINAL_VARIANTS: readonly TerminalVariant[] = ["marker", "rail", "boxed"];

/** The default gutter track width. Wide enough for one glyph plus its air. */
export const DEFAULT_TERMINAL_GUTTER = "1.25rem";

/**
 * The surface's one published value.
 *
 * **Discipline every row inherits: nothing else may ever be added here.** The
 * moment this context carries transcript state, expansion state or a clock,
 * this family becomes the provider-shaped Concept B that was rejected above,
 * and all twelve work units serialise onto one file.
 *
 * `null` means "no surface above me" — `useTerminalVariant()` resolves that to
 * the default, so a row dropped outside a `TerminalSurface` still renders
 * legibly rather than breaking.
 */
const TerminalVariantContext = createContext<TerminalVariant | null>(null);

/** Read the surrounding surface's gutter grammar. Falls back to `marker`. */
export function useTerminalVariant(): TerminalVariant {
  return use(TerminalVariantContext) ?? "marker";
}

export interface TerminalSurfaceProps extends HTMLAttributes<HTMLDivElement> {
  /** Gutter grammar for every row inside. A row may override it per-row. */
  variant?: TerminalVariant;
  /**
   * Width of the gutter track, as any CSS length. Written to the local
   * `--terminal-gutter` custom property — deliberately NOT a theme token: it
   * does not vary by theme and no other package needs it. A caller's own
   * `style` still wins over this.
   */
  gutter?: string;
  /**
   * `true` while the transcript has no renderable content yet (restoring a
   * past session). Renders layout-shaped skeleton rows through the REAL
   * `TerminalRow`, so the placeholder cannot drift from the grid it stands in
   * for. Never a spinner.
   */
  loading?: boolean;
  /** How many skeleton rows to reserve while `loading`. */
  loadingRows?: number;
  /** Overrides the announced loading label. Defaults to the shared "Loading…". */
  loadingLabel?: string;
}

/**
 * Widths cycle so the placeholder reads as text rather than as a bar chart.
 * Class strings, not inline widths, so they stay in Tailwind's scan.
 */
const SKELETON_WIDTHS = ["w-4/5", "w-3/5", "w-full", "w-2/5", "w-3/4"] as const;

export const TerminalSurface = forwardRef<HTMLDivElement, TerminalSurfaceProps>(
  function TerminalSurface(
    {
      variant = "marker",
      gutter = DEFAULT_TERMINAL_GUTTER,
      loading = false,
      loadingRows = 5,
      loadingLabel,
      className,
      style,
      children,
      ...props
    },
    ref,
  ) {
    const { t } = useLocale();
    const framed = use(TerminalFrameContext);

    return (
      <div
        ref={ref}
        data-slot="terminal-surface"
        data-variant={variant}
        // The caller's `style` is spread LAST so an explicit
        // `--terminal-gutter` from a consumer overrides the prop default.
        style={{ "--terminal-gutter": gutter, ...style } as CSSProperties}
        className={cn(
          framed
            ? // A region inside a TerminalConsole (ADR 0033): the frame
              // already drew the edge, radius, ground and lift, so this
              // surface draws none of them again. `ring-inset` keeps a
              // region's own `focus-within:ring-2` from being clipped on
              // three sides by the frame's `overflow-hidden`.
              "text-terminal-foreground ring-inset"
            : // Standalone: this surface IS a frame, unchanged from before
              // TerminalConsole existed. A border paired with a small lift,
              // never a float — `shadow-ring-*` is for overlays.
              "rounded-lg border border-terminal-border bg-terminal-background text-terminal-foreground shadow-sm",
          // `code` is the type ROLE; it pairs with `font-mono` by convention
          // (see `.claude/rules/styling-and-tokens.md` § Typography scale).
          "text-code font-mono",
          "flex flex-col gap-1 p-3",
          className,
        )}
        {...props}
      >
        <TerminalVariantContext value={variant}>
          {loading ? (
            <div
              data-slot="terminal-surface-loading"
              role="status"
              aria-live="polite"
              className="flex flex-col gap-1"
            >
              {/*
               * ONE live region for the whole not-ready area, never one per
               * box — a live region per skeleton floods assistive tech. The
               * boxes themselves are decorative; `Skeleton` already sets
               * `aria-hidden`, and the rows carry it too so the reserved grid
               * is not walked.
               */}
              <span className="sr-only">{loadingLabel ?? t("loading")}</span>
              {Array.from({ length: Math.max(0, loadingRows) }, (_, index) => (
                <TerminalRow
                  key={index}
                  aria-hidden="true"
                  data-slot="terminal-surface-loading-row"
                  gutter={<Skeleton className="h-3 w-3 rounded-sm" />}
                >
                  <Skeleton
                    className={cn(
                      "h-3 rounded-sm",
                      SKELETON_WIDTHS[index % SKELETON_WIDTHS.length],
                    )}
                  />
                </TerminalRow>
              ))}
            </div>
          ) : (
            children
          )}
        </TerminalVariantContext>
      </div>
    );
  },
);

TerminalSurface.displayName = "TerminalSurface";
