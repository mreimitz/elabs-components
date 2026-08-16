import { forwardRef, useId, type CSSProperties, type SVGProps } from "react";

export type BrandLogoVariant = "mark" | "lockup";

/** The mark's viewBox is square; the lockup's width is derived from the wordmark. */
export const BRAND_MARK_VIEWBOX_SIZE = 64;
/** Where the wordmark's baseline column starts inside the lockup viewBox. */
const WORDMARK_X = 78;
const WORDMARK_SIZE = 30;
const WORDMARK_TRACKING = 0.5;
const WORDMARK_TRAIL = 8;

/**
 * Advance widths in EM for the wordmark's face, grouped by width. Measured from
 * the vendored `Inter-Variable.woff` at `wght 600` (its `hmtx` table over
 * `unitsPerEm`), not estimated — SVG cannot measure text before it lays out, and
 * a component must not read the DOM to size itself, so the lockup's viewBox has
 * to be computed. An under-estimate CLIPS the wordmark, which is why this is a
 * real table rather than one average advance.
 *
 * A theme that points `--font-display` at another face makes it an approximation
 * again; `WORDMARK_TRAIL` plus the widest-glyph fallback below absorb that.
 */
const GLYPH_EM: ReadonlyArray<readonly [number, string]> = [
  [0.25, " "],
  [0.26, "ijl"],
  [0.28, "I"],
  [0.32, "!,.:"],
  [0.33, "';"],
  [0.35, "`t"],
  [0.36, "|"],
  [0.37, "()[]"],
  [0.38, "/\\"],
  [0.39, "f"],
  [0.4, "r"],
  [0.42, "1"],
  [0.45, "{}"],
  [0.47, "-_"],
  [0.48, "^"],
  [0.52, '"'],
  [0.54, "*?"],
  [0.55, "s"],
  [0.57, "Lakxz"],
  [0.58, "7Jc"],
  [0.59, "Fevy"],
  [0.61, "5Ehnou"],
  [0.62, "2bdpq"],
  [0.63, "g"],
  [0.64, "#3689"],
  [0.65, "$PRSZ"],
  [0.66, "&0BT"],
  [0.67, "+4<=>~"],
  [0.7, "K"],
  [0.71, "Y"],
  [0.72, "DX"],
  [0.73, "AV"],
  [0.74, "CU"],
  [0.75, "GH"],
  [0.76, "N"],
  [0.77, "OQ"],
  [0.84, "w"],
  [0.9, "m"],
  [0.92, "M"],
  [1.0, "%@"],
  [1.02, "W"],
];
/** The widest glyph in the table — the safe assumption for anything outside it. */
const FALLBACK_EM = 1.02;
const GLYPH_ADVANCE = new Map<string, number>(
  GLYPH_EM.flatMap(([em, chars]) => [...chars].map((ch) => [ch, em] as const)),
);

/**
 * The lockup viewBox width for a given wordmark. Rounded UP, so the rendered
 * text can never overflow the viewBox that was sized for it.
 */
export function brandLockupWidth(title: string): number {
  const text = title.trim() || "•";
  const glyphs = [...text];
  const advance = glyphs.reduce((sum, ch) => sum + (GLYPH_ADVANCE.get(ch) ?? FALLBACK_EM), 0);
  return Math.ceil(
    WORDMARK_X + advance * WORDMARK_SIZE + glyphs.length * WORDMARK_TRACKING + WORDMARK_TRAIL,
  );
}

export interface BrandLogoProps extends SVGProps<SVGSVGElement> {
  /** "mark" = the circle-and-square glyph only; "lockup" = glyph + wordmark. Defaults to "lockup". */
  variant?: BrandLogoVariant;
  /** Rendered height in px. Width scales with the variant. Defaults to 28. */
  height?: number;
  /**
   * Color treatment. "auto" (default) reads the per-theme brand-mark tokens, so
   * the mark takes the active theme's approved colorway. "white" forces the
   * fully-white mark for placing ON a colored surface (a primary button, a dark
   * brand chip).
   */
  tone?: "auto" | "white";
  /**
   * Accessible name — AND, in the `lockup` variant, the wordmark that is
   * rendered beside the glyph. Defaults to "Brand".
   *
   * This is the seam that makes the logo unbranded: a consumer passes their own
   * name and gets their own lockup, with no SVG path data to edit. The glyph
   * itself is the only fixed part.
   */
  title?: string;
}

/* ── The mark: a reprographic set-out drawing ────────────────────────────────
   Not a pictogram — the mark IS the repo's drafting language (dashed
   construction lines, 45° hatch, register dots), which is what makes it read as
   this design system rather than as a generic app glyph.

   Two inks, no third: the SQUARE is the brand plane (`--brand-mark-tail`, the
   theme's primary) and every DRAWN element — circle, hatch, dots, stray strokes
   — is ink (`--brand-mark-ring`, `currentColor` by default). That split is what
   makes it background-adaptive with no per-place override: the linework follows
   the surrounding text colour, so it is grey on a light surface and white on a
   dark one, while the plane stays brand-coloured. */

/** Construction square — the brand plane. Bottom-left, dashed, washed. */
const SQUARE = { x: 5.5, y: 21.5, size: 37 } as const;
/** Hatched circle swung over the square's top-right corner. */
const CIRCLE = { cx: 42, cy: 23, r: 19.5 } as const;
/** Register dots — the drawing's set-out marks (one on the overlap, one free). */
const DOTS: ReadonlyArray<readonly [number, number]> = [
  [34.5, 30],
  [44.5, 47],
];
/** Stray hatch strokes outside both shapes: `[x1, y1, x2, y2]`. */
const STRAY: ReadonlyArray<readonly [number, number, number, number]> = [
  [48, 58, 53.5, 52.5],
  [55, 50, 60.5, 44.5],
];

/**
 * Gap between hatch lines, in viewBox units. Tuned by rendering, not by taste:
 * at a 5-unit gap the circle fuses into a solid disc below ~64px, which is most
 * of the sizes a logo is actually seen at. 7 keeps the hatch legible as hatch at
 * 32px and still reads as texture at 128.
 */
const HATCH_STEP = 7;
/**
 * The 45° hatch as the family of lines `x + y = c`, DERIVED from the circle
 * rather than hand-listed: a chord exists for exactly
 * `c ∈ [cx + cy ± r√2]`, so moving or resizing the circle can never leave the
 * hatch short at one edge (a hand-kept list silently would).
 */
function hatchOffsets(): number[] {
  const mid = CIRCLE.cx + CIRCLE.cy;
  const reach = CIRCLE.r * Math.SQRT2;
  const first = Math.ceil((mid - reach) / HATCH_STEP) * HATCH_STEP;
  const count = Math.floor((mid + reach - first) / HATCH_STEP) + 1;
  // Indexed, never accumulated. A fractional HATCH_STEP added in a loop drifts
  // into values like 39.99999999999999, which would reach the DOM verbatim — and
  // the two hand-synced static copies of this drawing (the favicon and the
  // Storybook manager logo) are compared coordinate-for-coordinate against this
  // output by brand-mark-assets.test.tsx.
  return Array.from({ length: count }, (_, i) => Number((first + i * HATCH_STEP).toFixed(4)));
}
const HATCH = hatchOffsets();

/**
 * The brand logo: a hatched circle swung over a dashed construction square, with
 * a wordmark in the `lockup` variant.
 *
 * **Background-adaptive by construction, not by a prop.** The mark is exactly two
 * inks: the drawn linework (circle, hatch, register dots, stray strokes) takes
 * `--brand-mark-ring`, which defaults to `currentColor` — so it is grey on a light
 * surface and white on a dark one, with no per-place override and no
 * `prefers-color-scheme` branch. The construction square takes
 * `--brand-mark-tail`, the theme's primary. Both are set per theme in
 * `@elabs-ai/components-tokens`, so the mark always renders the active theme's
 * approved colorway. Pass `tone="white"` to force the monochrome white mark on a
 * colored background. No background fill — drop it straight onto any surface.
 *
 * The glyph is fixed; the WORDMARK is not. `title` is both the accessible name
 * and the text rendered in the lockup, so a product ships its own name without
 * touching path data:
 *
 *     <BrandLogo variant="lockup" title={productName} />
 *
 * A logotype is exempt from WCAG contrast requirements, which is why the
 * brand-mark tokens are the one place a theme may pin a raw hex — the shipped
 * themes do not need to, because both rungs resolve from tokens that already
 * track the surface.
 */
export const BrandLogo = forwardRef<SVGSVGElement, BrandLogoProps>(function BrandLogo(
  { variant = "lockup", height = 28, tone = "auto", title = "Brand", style, ...props },
  ref,
) {
  const isLockup = variant === "lockup";
  const vbWidth = isLockup ? brandLockupWidth(title) : BRAND_MARK_VIEWBOX_SIZE;
  const width = Math.round((height * vbWidth) / BRAND_MARK_VIEWBOX_SIZE);
  const toneStyle: CSSProperties | undefined =
    tone === "white"
      ? ({ "--brand-mark-ring": "#FFFFFF", "--brand-mark-tail": "#FFFFFF" } as CSSProperties)
      : undefined;
  // The ink follows the surrounding text colour by default, so the mark reads
  // correctly on a page, on dark chrome, and on a surface a consumer invents —
  // that IS the light/dark adaptation. The plane falls back to the theme's
  // primary, so a consumer who never sets the brand-mark tokens still gets the
  // two-ink mark rather than a flat monochrome one.
  const ink = "var(--brand-mark-ring, currentColor)";
  const plane = "var(--brand-mark-tail, var(--primary, currentColor))";
  // Each instance needs its own clip-path id — two logos on one page would
  // otherwise share (and fight over) a single `#hatch`.
  const clipId = `brand-mark-hatch-${useId().replace(/:/g, "")}`;

  return (
    <svg
      ref={ref}
      height={height}
      width={width}
      viewBox={`0 0 ${vbWidth} ${BRAND_MARK_VIEWBOX_SIZE}`}
      role="img"
      aria-label={title}
      style={toneStyle ? { ...toneStyle, ...style } : style}
      {...props}
    >
      <title>{title}</title>
      <defs>
        <clipPath id={clipId}>
          <circle cx={CIRCLE.cx} cy={CIRCLE.cy} r={CIRCLE.r} />
        </clipPath>
      </defs>
      {/* Paint order IS the composition: the plane is laid out first, the drawing
          is struck over it. */}
      <rect
        x={SQUARE.x}
        y={SQUARE.y}
        width={SQUARE.size}
        height={SQUARE.size}
        fill={plane}
        fillOpacity={0.22}
        stroke={plane}
        strokeWidth={2.2}
        strokeDasharray="4.5 4.5"
        strokeLinecap="square"
      />
      <g clipPath={`url(#${clipId})`} stroke={ink} strokeWidth={1.8}>
        {HATCH.map((c) => (
          <line
            key={c}
            x1={c - BRAND_MARK_VIEWBOX_SIZE}
            y1={BRAND_MARK_VIEWBOX_SIZE}
            x2={c}
            y2={0}
          />
        ))}
      </g>
      <circle
        cx={CIRCLE.cx}
        cy={CIRCLE.cy}
        r={CIRCLE.r}
        fill="none"
        stroke={ink}
        strokeWidth={2.4}
      />
      {DOTS.map(([cx, cy]) => (
        <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={2.2} fill={ink} />
      ))}
      <g stroke={ink} strokeWidth={1.8} strokeLinecap="round">
        {STRAY.map(([x1, y1, x2, y2]) => (
          <line key={`${x1}-${y1}`} x1={x1} y1={y1} x2={x2} y2={y2} />
        ))}
      </g>
      {isLockup ? (
        <text
          x={WORDMARK_X}
          y={BRAND_MARK_VIEWBOX_SIZE / 2}
          fill={ink}
          fontFamily="var(--font-display, var(--font-sans, sans-serif))"
          fontSize={WORDMARK_SIZE}
          fontWeight={600}
          letterSpacing={WORDMARK_TRACKING}
          dominantBaseline="central"
          /* The <title> above already names the whole logo; the wordmark would
             otherwise be announced a second time. */
          aria-hidden="true"
        >
          {title}
        </text>
      ) : null}
    </svg>
  );
});
