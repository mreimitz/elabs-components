import { forwardRef, type CSSProperties, type HTMLAttributes } from "react";
import { cn } from "@elabs/components-ui/lib/cn";

export type GridPaperVariant = "lines" | "dots" | "crosshatch" | "hatch";
export type GridPaperSize = "sm" | "md" | "lg";

/**
 * Which way the ruling fades out. The same four shapes the ambient
 * `data-decoration-fade` region hook uses (`--bp-fade-*` in themes.css), so a
 * hand-placed GridPaper and a faded region read as the same gesture.
 */
export type GridPaperFade = "top" | "bottom" | "edges" | "center";

export interface GridPaperProps extends HTMLAttributes<HTMLDivElement> {
  /** Ruling style. @default "lines" */
  variant?: GridPaperVariant;
  /** Minor cell pitch. @default "md" */
  size?: GridPaperSize;
  /**
   * Fade the ruling out with a soft mask. `true` === `"edges"` — the vignette
   * this prop has always drawn. NOTE the mask applies to the whole element, so
   * any children fade with it; use it on a decorative (childless) `GridPaper`.
   * For an ambient region fade that leaves content alone, use the decoration
   * system’s `data-decoration-fade` hook instead (see blueprint-decoration.md).
   */
  fade?: boolean | GridPaperFade;
}

/** Mask shapes, shared with the decoration dial (see themes.css `--bp-fade-*`). */
const FADE_VAR: Record<GridPaperFade, string> = {
  top: "var(--bp-fade-top)",
  bottom: "var(--bp-fade-bottom)",
  edges: "var(--bp-fade-edges)",
  center: "var(--bp-fade-center)",
};

const MINOR: Record<GridPaperSize, number> = { sm: 6, md: 8, lg: 12 };

/** Build a token-driven background-image (colors are CSS vars — no raw hex). */
function ruling(variant: GridPaperVariant, minor: number): string {
  const line = "var(--grid-line)";
  const major = "var(--grid-line-major)";
  const big = minor * 10;
  switch (variant) {
    case "dots":
      return `radial-gradient(${line} 1px, transparent 1.5px)`;
    case "hatch":
      return `repeating-linear-gradient(45deg, ${major} 0, ${major} 1px, transparent 1px, transparent ${minor}px)`;
    case "crosshatch":
      return [
        `repeating-linear-gradient(45deg, ${line} 0, ${line} 1px, transparent 1px, transparent ${minor}px)`,
        `repeating-linear-gradient(-45deg, ${line} 0, ${line} 1px, transparent 1px, transparent ${minor}px)`,
      ].join(", ");
    case "lines":
    default:
      return [
        `repeating-linear-gradient(to right, ${major} 0, ${major} 1px, transparent 1px, transparent ${big}px)`,
        `repeating-linear-gradient(to bottom, ${major} 0, ${major} 1px, transparent 1px, transparent ${big}px)`,
        `repeating-linear-gradient(to right, ${line} 0, ${line} 1px, transparent 1px, transparent ${minor}px)`,
        `repeating-linear-gradient(to bottom, ${line} 0, ${line} 1px, transparent 1px, transparent ${minor}px)`,
      ].join(", ");
  }
}

/** Resolve the `fade` prop to a mask shape (`true` keeps the historic vignette). */
function fadeMask(fade: boolean | GridPaperFade): string | null {
  if (!fade) return null;
  return FADE_VAR[fade === true ? "edges" : fade];
}

/**
 * Graph-paper ground. A token-driven ruled (or dotted / cross-hatched) surface
 * that everything else is drawn on. Decorative when empty (aria-hidden); when
 * given children it acts as a layout ground and they render above the ruling.
 */
export const GridPaper = forwardRef<HTMLDivElement, GridPaperProps>(function GridPaper(
  { variant = "lines", size = "md", fade = false, className, style, children, ...props },
  ref,
) {
  const minor = MINOR[size];
  const mask = fadeMask(fade);
  const mergedStyle: CSSProperties = {
    backgroundColor: "var(--canvas)",
    backgroundImage: ruling(variant, minor),
    ...(variant === "dots" ? { backgroundSize: `${minor}px ${minor}px` } : null),
    ...(mask ? { maskImage: mask, WebkitMaskImage: mask } : null),
    ...style,
  };
  return (
    <div
      ref={ref}
      data-slot="grid-paper"
      aria-hidden={children ? undefined : true}
      className={cn("relative", className)}
      style={mergedStyle}
      {...props}
    >
      {children}
    </div>
  );
});
