import { forwardRef, type CSSProperties, type SVGProps } from "react";

export type BrandLogoVariant = "mark" | "lockup";

export interface BrandLogoProps extends SVGProps<SVGSVGElement> {
  /** "mark" = the Q glyph only; "lockup" = Q + "Qlik" wordmark. Defaults to "lockup". */
  variant?: BrandLogoVariant;
  /** Rendered height in px. Width scales with the variant. Defaults to 28. */
  height?: number;
  /**
   * Color treatment. "auto" (default) reads the per-theme brand-mark tokens —
   * green + Qlik-gray on light themes, green + white on dark, fully white on
   * blueprint. "white" forces the fully-white lockup for placing ON a colored
   * surface (e.g. a green button or a dark brand chip).
   */
  tone?: "auto" | "white";
  /** Accessible name. Defaults to "Qlik". */
  title?: string;
}

/**
 * The Qlik brand logo. Brand-locked and theme-aware: the ring/letterforms use
 * `--brand-mark-ring` and the Q tail uses `--brand-mark-tail`, both set per
 * theme in `@elabs/components-tokens` themes.css, so the mark always renders an approved
 * Qlik colorway (green+gray, green+white, or fully white) that fits the active
 * theme. Pass `tone="white"` to force the monochrome white mark on a colored
 * background. No background fill — drop it straight onto any surface.
 */
export const BrandLogo = forwardRef<SVGSVGElement, BrandLogoProps>(function BrandLogo(
  { variant = "lockup", height = 28, tone = "auto", title = "Qlik", style, ...props },
  ref,
) {
  const isLockup = variant === "lockup";
  const width = Math.round(height * (isLockup ? 662 / 278 : 298 / 288));
  const toneStyle: CSSProperties | undefined =
    tone === "white"
      ? ({ "--brand-mark-ring": "#FFFFFF", "--brand-mark-tail": "#FFFFFF" } as CSSProperties)
      : undefined;
  const ring = "var(--brand-mark-ring, #54565A)";
  const tail = "var(--brand-mark-tail, #009845)";

  return (
    <svg
      ref={ref}
      height={height}
      width={width}
      viewBox={isLockup ? "119 111 662 278" : "115 105 298 288"}
      role="img"
      aria-label={title}
      style={toneStyle ? { ...toneStyle, ...style } : style}
      {...props}
    >
      <title>{title}</title>
      {isLockup ? (
        <>
          {/* "lik" letterforms */}
          <rect x="444.93" y="117.39" width="27.6" height="264.09" fill={ring} />
          <rect x="519.96" y="197.03" width="27.47" height="184.45" fill={ring} />
          <circle cx="533.98" cy="136.23" r="18.84" fill={ring} />
          <path
            d="M740.71 197.01 702.38 197.01 622.94 266.59 622.78 117.39 595.31 117.39 595.31 381.48 622.78 381.48 622.78 296.28 704.39 381.48 742.59 381.48 645.31 282.85 740.71 197.01Z"
            fill={ring}
          />
          {/* trademark */}
          <path
            d="M780.5 368.45 780.5 381.55 778.22 381.55 778.22 372.63 774.27 381.55 773.06 381.55 769.11 372.64 769.11 381.55 766.83 381.55 766.83 368.45 769.6 368.45 773.67 378.06 777.72 368.45 780.5 368.45Z"
            fill={ring}
          />
          <path
            d="M764.55 368.45 764.55 370.45 760.57 370.45 760.57 381.55 758.29 381.55 758.29 370.45 754.31 370.45 754.31 368.45 764.55 368.45Z"
            fill={ring}
          />
        </>
      ) : null}
      {/* Q ring */}
      <path
        d="M326.63 336.35C307.83 351.27 284.05 360.19 258.18 360.19 197.32 360.19 147.99 310.86 147.99 250 147.99 223.85 157.11 199.83 172.33 180.93L152.16 160.62C131.79 184.76 119.51 215.94 119.51 250 119.51 326.59 181.6 388.67 258.18 388.67 291.88 388.67 322.77 376.64 346.8 356.66L326.63 336.35Z"
        fill={ring}
      />
      {/* Q tail (Qlik Green) */}
      <path
        d="M369.4 381.55 407.6 381.55 366.4 336.67C385.44 312.93 396.84 282.8 396.84 249.99 396.84 173.4 334.75 111.32 258.17 111.32 215.64 111.32 177.59 130.47 152.15 160.62L172.32 180.93C192.52 155.86 223.47 139.81 258.17 139.81 319.03 139.81 368.36 189.14 368.36 250 368.36 284.99 352.05 316.16 326.62 336.35L345.51 355.37 346.58 356.46 369.39 381.56Z"
        fill={tail}
      />
    </svg>
  );
});
