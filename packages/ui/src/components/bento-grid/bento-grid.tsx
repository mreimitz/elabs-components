"use client";

/**
 * BentoGrid + BentoGridItem — "spotlight bento" layout.
 *
 * A responsive dense CSS-grid container with a reduced-motion-safe cursor-
 * following spotlight on each tile. The spotlight color is a DERIVED tint of the
 * `--primary` token (`color-mix(in oklch, var(--primary) 12%, transparent)`), so
 * it stays theme-correct in every theme with no raw colors and no extra token.
 * Under OS reduced-motion the spotlight is suppressed entirely
 * (`motion-reduce:hidden`); tiles still respond to hover/focus with their normal
 * card states.
 *
 * Key design choices:
 * - `BentoGridItem` composes `Card` (inherits card surface/border/radius).
 * - Spans are inline `grid-column/grid-row` and collapse to one cell on the
 *   1-column mobile grid (the browser caps a span at the available tracks).
 * - The tile is presentational; for a clickable tile, place an interactive inner
 *   element (e.g. a stretched `<a className="absolute inset-0">`) and set
 *   `interactive` so the tile shows a `focus-within` ring.
 * - The spotlight overlay is `pointer-events-none` + `aria-hidden` (decorative).
 * - Motion is gated via `duration-base` / `ease-standard` (token-backed).
 */

import { forwardRef, useRef, useCallback, type CSSProperties, type HTMLAttributes } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/cn";
import { cardVariants } from "../card/card";

// ---------------------------------------------------------------------------
// BentoGrid
// ---------------------------------------------------------------------------

export interface BentoGridProps extends HTMLAttributes<HTMLDivElement> {
  /** Additional className merged via cn(). */
  className?: string;
}

/**
 * Responsive CSS-grid container.
 * - 1 column on mobile, 2 on sm, 4 on lg.
 * - `grid-auto-flow: dense` fills in gaps left by spanning tiles.
 * - `auto-rows-[14rem]` gives a baseline row height (14rem ≈ 224px); tiles can
 *   span multiple rows via the `size` / `span.row` API.
 */
export const BentoGrid = forwardRef<HTMLDivElement, BentoGridProps>(function BentoGrid(
  { className, children, ...props },
  ref,
) {
  return (
    <div
      ref={ref}
      className={cn(
        "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4",
        "[grid-auto-flow:dense]",
        "auto-rows-[14rem]",
        "gap-4",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
});

// ---------------------------------------------------------------------------
// BentoGridItem — size / span presets
// ---------------------------------------------------------------------------

/**
 * Size preset → [colSpan, rowSpan].
 *
 * | size  | cols | rows | purpose                                                    |
 * |-------|------|------|------------------------------------------------------------|
 * | sm    |  1   |  1   | Supporting: compact metric or icon tile                    |
 * | md    |  2   |  1   | Supporting: wider but single-row                           |
 * | lg    |  2   |  2   | Featured: 2×2 block                                        |
 * | hero  |  2   |  2   | Hero: 2×2 + gradient emphasis wash                         |
 *
 * On a 1-column layout (mobile) ALL col spans clamp to 1 automatically via
 * CSS `min()` in `gridColumn`. Row spans are always honoured.
 */
export type BentoGridSize = "sm" | "md" | "lg" | "hero";

const SIZE_SPANS: Record<BentoGridSize, { col: number; row: number }> = {
  sm: { col: 1, row: 1 },
  md: { col: 2, row: 1 },
  lg: { col: 2, row: 2 },
  hero: { col: 2, row: 2 },
};

// cva for the item's structural/visual axes (NOT size — span is applied via
// inline style so it collapses correctly on mobile without media-query gymnastics).
export const bentoGridItemVariants = cva(
  [
    // Base: compose Card surface (bg-card border rounded-lg shadow-sm).
    cardVariants({ interactive: false }),
    // Overflow hidden so content + spotlight overlay stay within rounded corners.
    "relative overflow-hidden",
    // Flex column layout for slot content.
    "flex flex-col",
    // Ensure long unbroken strings can't overflow the tile.
    "min-w-0 break-words",
  ].join(" "),
  {
    variants: {
      /** Hero tile gets a subtle gradient wash to distinguish it from supporting tiles. */
      hero: {
        true: "bg-gradient-to-br from-primary/8 to-card",
        false: "",
      },
      /**
       * Interactive tiles (those holding a clickable inner element, e.g. a
       * stretched link) get a pointer cursor, a hover border accent, and a
       * `focus-within` ring so keyboard focus on the inner control is visible on
       * the whole tile.
       */
      interactive: {
        true: "cursor-pointer transition-[border-color,box-shadow] duration-base ease-standard hover:border-border-strong focus-within:outline-none focus-within:ring-2 focus-within:ring-ring motion-reduce:transition-none",
        false: "",
      },
    },
    defaultVariants: { hero: false, interactive: false },
  },
);

export type BentoGridItemVariants = VariantProps<typeof bentoGridItemVariants>;

export interface BentoGridItemProps extends HTMLAttributes<HTMLDivElement>, BentoGridItemVariants {
  /**
   * Size preset. Resolves to a col + row span. Overridden by explicit `span`.
   * @default "sm"
   */
  size?: BentoGridSize;
  /**
   * Explicit grid span. Wins over `size`. Spans clamp gracefully on narrow
   * layouts — a `col: 4` on a 2-col grid becomes `span min(4, 2)`.
   */
  span?: { col?: number; row?: number };
  /**
   * Enable the cursor-following spotlight gradient. Disabled entirely under
   * OS `prefers-reduced-motion` regardless of this prop.
   * @default true
   */
  spotlight?: boolean;
}

/**
 * A single bento tile. Composes `Card` and adds the spotlight overlay.
 *
 * Spotlight:
 * - Sets `--bento-x` / `--bento-y` CSS custom properties on `onMouseMove`
 *   via a direct style set (no layout reads in render — uses
 *   `getBoundingClientRect` in the event handler only, never during paint).
 * - An absolutely-positioned `pointer-events-none aria-hidden` overlay paints
 *   `radial-gradient(… at var(--bento-x) var(--bento-y), color-mix(--primary), transparent)`.
 * - Revealed on hover via opacity transition gated by `duration-base ease-standard`.
 * - Suppressed with `motion-reduce:hidden` — cursor-following IS motion.
 */
export const BentoGridItem = forwardRef<HTMLDivElement, BentoGridItemProps>(function BentoGridItem(
  { size = "sm", span, spotlight = true, hero, interactive, className, style, children, ...props },
  ref,
) {
  const tileRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  // Resolve spans: explicit span wins over size preset.
  const resolvedCol = span?.col ?? SIZE_SPANS[size].col;
  const resolvedRow = span?.row ?? SIZE_SPANS[size].row;

  const isInteractive = interactive ?? false;

  // isHero: explicit prop or size === "hero".
  const isHero = hero ?? size === "hero";

  // rAF ref so we only schedule one frame at a time.
  const rafRef = useRef<number>(0);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!spotlight || !tileRef.current || !overlayRef.current) return;
      // Cancel pending rAF to debounce rapid moves.
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => {
        if (!tileRef.current || !overlayRef.current) return;
        const rect = tileRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        // Direct style mutation — no React render cycle.
        tileRef.current.style.setProperty("--bento-x", `${x}px`);
        tileRef.current.style.setProperty("--bento-y", `${y}px`);
        overlayRef.current.style.opacity = "1";
      });
    },
    [spotlight],
  );

  const handleMouseLeave = useCallback(() => {
    if (!overlayRef.current) return;
    overlayRef.current.style.opacity = "0";
  }, []);

  // Grid span via inline style. On mobile (grid-cols-1) a col-span of any value
  // is effectively clamped to 1 by the grid itself — a 4-col tile in a 1-col
  // grid still renders in one cell. Row spans are always honoured as-is.
  // We use `gridColumn: "span N / span N"` which the browser safely caps at the
  // available track count; no CSS min() with custom-property arithmetic needed.
  const gridStyle: CSSProperties = {
    gridColumn: resolvedCol > 1 ? `span ${resolvedCol} / span ${resolvedCol}` : undefined,
    gridRow: resolvedRow > 1 ? `span ${resolvedRow} / span ${resolvedRow}` : undefined,
    ...style,
  };

  // Merge the forwarded ref and the internal tileRef into one callback ref.
  const mergedRef = useCallback(
    (node: HTMLDivElement | null) => {
      (tileRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
      if (typeof ref === "function") {
        ref(node);
      } else if (ref) {
        (ref as React.MutableRefObject<HTMLDivElement | null>).current = node;
      }
    },
    [ref],
  );

  return (
    <div
      ref={mergedRef as React.Ref<HTMLDivElement>}
      className={cn(
        bentoGridItemVariants({
          hero: isHero,
          interactive: isInteractive,
        }),
        className,
      )}
      style={gridStyle}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      {...props}
    >
      {/* Spotlight overlay — decorative, pointer-events-none, aria-hidden.
            Hidden in full under reduced-motion (the cursor-following IS the motion).
            Color is a color-mix tint of --primary (token-derived, no raw color). */}
      {spotlight && (
        <div
          ref={overlayRef}
          aria-hidden="true"
          data-testid="bento-spotlight"
          className={cn(
            "pointer-events-none absolute inset-0 z-10",
            "opacity-0 transition-opacity duration-base ease-standard",
            // Suppress entirely under reduced-motion (cursor tracking = motion).
            "motion-reduce:hidden",
          )}
          style={{
            // Spotlight color is a DERIVED tint of the --primary token (not a raw
            // literal), so it stays theme-correct in every theme without a new
            // token. `color-mix` keeps it ~12% primary over transparent.
            background:
              "radial-gradient(400px circle at var(--bento-x, 50%) var(--bento-y, 50%), color-mix(in oklch, var(--primary) 12%, transparent), transparent 70%)",
          }}
        />
      )}
      {/* Tile content — min-w-0 on inner wrapper prevents flex children from
            overflowing on long unbroken strings (the silent truncation culprit). */}
      <div className="relative z-20 flex min-w-0 flex-1 flex-col">{children}</div>
    </div>
  );
});
