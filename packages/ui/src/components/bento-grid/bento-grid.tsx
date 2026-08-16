"use client";

/**
 * BentoGrid + BentoGridItem — a hover-elevation bento layout.
 *
 * A responsive dense CSS-grid container. **The default separation gesture is
 * ELEVATION, not colour:** the grid rests flat (`shadow-none` — border only) and
 * each tile rises ~4px into `shadow-xl` with a brand-tinted edge on hover, so the
 * tile under the pointer clearly separates from the sheet.
 *
 * The cursor-following **spotlight is OPT-IN** (`spotlight`, default `false`) —
 * set it on the `BentoGrid` to enable it for every tile, or per tile to override
 * the grid. Its colour is a DERIVED tint of the `--primary` token
 * (`color-mix(in oklch, var(--primary) 12%, transparent)`), so it stays
 * theme-correct in every theme with no raw colors and no extra token. Under OS
 * reduced-motion the spotlight is suppressed entirely (`motion-reduce:hidden`);
 * tiles still respond to hover/focus with their normal card states.
 *
 * Key design choices:
 * - `BentoGridItem` composes `Card` (inherits card surface/border/radius) and
 *   then overrides the resting `shadow-sm` down to `shadow-none`.
 * - Under reduced motion the travel is neutralized and the transition dropped —
 *   the shadow and the edge still state the hover ("reduced != none").
 * - Spans are inline `grid-column/grid-row` and collapse to one cell on the
 *   1-column mobile grid (the browser caps a span at the available tracks).
 * - The tile is presentational; for a clickable tile, place an interactive inner
 *   element (e.g. a stretched `<a className="absolute inset-0">`) and set
 *   `interactive` so the tile shows a `focus-within` ring.
 * - The spotlight overlay is `pointer-events-none` + `aria-hidden` (decorative).
 * - Motion is gated via `duration-base` / `ease-standard` (token-backed).
 */

import {
  createContext,
  forwardRef,
  use,
  useRef,
  useCallback,
  type CSSProperties,
  type HTMLAttributes,
} from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/cn";
import { cardVariants } from "../card/card";

// ---------------------------------------------------------------------------
// Context — the grid hands its spotlight default down to every tile so a whole
// bento can opt in with ONE prop instead of repeating it on every child. A tile's
// own `spotlight` prop always wins.
// ---------------------------------------------------------------------------

const BentoGridContext = createContext<{ spotlight: boolean }>({ spotlight: false });

// ---------------------------------------------------------------------------
// BentoGrid
// ---------------------------------------------------------------------------

export interface BentoGridProps extends HTMLAttributes<HTMLDivElement> {
  /** Additional className merged via cn(). */
  className?: string;
  /**
   * Enable the cursor-following spotlight on every tile in this grid. Individual
   * tiles can still opt out (or in) with their own `spotlight` prop. Disabled
   * entirely under OS `prefers-reduced-motion` regardless of this prop.
   * @default false
   */
  spotlight?: boolean;
}

/**
 * Responsive CSS-grid container.
 * - 1 column on mobile, 2 on sm, 4 on lg.
 * - `grid-auto-flow: dense` fills in gaps left by spanning tiles.
 * - `auto-rows-[14rem]` gives a baseline row height (14rem ≈ 224px); tiles can
 *   span multiple rows via the `size` / `span.row` API.
 * - Carries the grid-wide `spotlight` default for its tiles (opt-in).
 */
export const BentoGrid = forwardRef<HTMLDivElement, BentoGridProps>(function BentoGrid(
  { className, spotlight = false, children, ...props },
  ref,
) {
  return (
    <BentoGridContext value={{ spotlight }}>
      <div
        ref={ref}
        data-slot="bento-grid"
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
    </BentoGridContext>
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
    // ELEVATION IS THE HOVER GESTURE. The grid rests FLAT — `shadow-none` beats
    // the `shadow-sm` inherited from `cardVariants` (tailwind-merge, later wins)
    // so a bento sheet reads as one plane, not a field of lifted chips. On hover
    // the single tile under the pointer rises to `shadow-lg`, a stacked rung of
    // the ONE elevation ramp (never a hand-rolled box-shadow). The rung is
    // `hover:`-prefixed, so pairing it with the card border is the sanctioned
    // "bordered card, hover lift" shape, not the flagged double edge.
    "shadow-none hover:shadow-xl",
    // Shadow alone is a LIGHT-theme signal: the ramp's ink is black, so on a dark
    // ground even `shadow-xl` is faint (measured on `theme:dark` — the hovered tile
    // was hard to pick out). The hover EDGE carries the lift there. It is
    // `ring/40`, the same tint `Card interactive` uses — NOT `border-strong`, which
    // is a near-charcoal 0.65 L against a 0.88 L resting border and reads as a hard
    // outline snapping on, not as a lift. At 40% the brand hue stays a soft warm
    // edge on white and a clearly brighter one on charcoal.
    "hover:border-ring/40",
    // A lift you can SEE: ~4px of travel. Below ~16px a slide is a flicker, but a
    // hover-lift is the exception the motion guidelines size at ≥4px — and the
    // travel, not the duration, is what makes the elevation legible.
    "hover:-translate-y-1 motion-reduce:hover:translate-y-0",
    // `ease-entrance` (easeOutQuint) — a near-zero arrival velocity is the #1
    // smoothness lever; `ease-standard` snaps at the end. Duration stays at the
    // 260ms `base` rung: lengthening it does NOT fix abruptness. Under OS
    // reduced-motion the travel is neutralized and the transition is dropped, so
    // the shadow + edge still state the hover without any movement.
    "transition-[translate,box-shadow,border-color] duration-base ease-entrance motion-reduce:transition-none",
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
       * stretched link) get a pointer cursor and a `focus-within` ring so keyboard
       * focus on the inner control is visible on the whole tile. The hover lift
       * (elevation + edge) is on the base — every tile lifts, clickable or not.
       */
      interactive: {
        true: "cursor-pointer focus-within:outline-none focus-within:ring-2 focus-within:ring-ring",
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
   * Enable the cursor-following spotlight gradient on this tile. Omit to inherit
   * the parent `BentoGrid`'s `spotlight` (itself `false` by default) — so the
   * effect is opt-in, per grid or per tile. Disabled entirely under OS
   * `prefers-reduced-motion` regardless of this prop.
   * @default false (inherited from BentoGrid)
   */
  spotlight?: boolean;
}

/**
 * A single bento tile. Composes `Card`, rests flat, lifts to `shadow-lg` on
 * hover, and adds the OPT-IN spotlight overlay.
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
  { size = "sm", span, spotlight, hero, interactive, className, style, children, ...props },
  ref,
) {
  const tileRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  // Own prop wins; otherwise inherit the grid's opt-in (default false).
  const spotlightOn = spotlight ?? use(BentoGridContext).spotlight;

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
      if (!spotlightOn || !tileRef.current || !overlayRef.current) return;
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
    [spotlightOn],
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
      data-slot="bento-grid-item"
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      {...props}
    >
      {/* Spotlight overlay — OPT-IN, decorative, pointer-events-none, aria-hidden.
            Hidden in full under reduced-motion (the cursor-following IS the motion).
            Color is a color-mix tint of --primary (token-derived, no raw color). */}
      {spotlightOn && (
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
