import { forwardRef, type ReactNode, type SVGProps } from "react";

/** `outline` (default, every icon) or `solid` (only icons `createIcon` gave a
 * `solid` glyph). Omit to let the theme's `--icon-fill` token pick. */
export type IconVariant = "outline" | "solid";

export interface IconProps extends SVGProps<SVGSVGElement> {
  /** Pixel size for both width & height. Defaults to 24. */
  size?: number | string;
  /**
   * Accessible name. When provided the icon is exposed to AT as an image;
   * when omitted the icon is treated as decorative (aria-hidden).
   */
  title?: string;
  /**
   * Force the outline or solid glyph, overriding the theme's `--icon-fill`
   * token. Only icons created with `createIcon`'s `solid` option have a
   * solid glyph to switch to — every other icon renders outline regardless
   * of this prop. `Icon` used directly with raw `children` ignores it (it
   * has no separate solid content to switch to).
   */
  variant?: IconVariant;
}

/**
 * Generic, brand-consistent SVG wrapper. All sample icons render through this
 * so stroke width, line caps, sizing and accessibility stay uniform. Color is
 * inherited via `currentColor`, so icons theme automatically with text color.
 */
export const Icon = forwardRef<SVGSVGElement, IconProps>(function Icon(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- accepted for IconProps parity with createIcon output; Icon has no solid content of its own to switch on, so it never forwards `variant` onto the DOM.
  { size = 24, title, children, strokeWidth = 2, variant, ...props },
  ref,
) {
  const decorative = !title;
  return (
    <svg
      ref={ref}
      data-slot="icon"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      role={decorative ? "presentation" : "img"}
      aria-hidden={decorative ? true : undefined}
      aria-label={title}
      focusable="false"
      {...props}
    >
      {title ? <title>{title}</title> : null}
      {children}
    </svg>
  );
});

export interface CreateIconOptions {
  /**
   * Filled counterpart of `node`. When set, the resulting component honours
   * `variant="outline" | "solid"` and, with `variant` omitted, renders both
   * glyphs (`data-icon-glyph="outline"|"solid"`) so the theme's `--icon-fill`
   * token can pick between them via CSS (`themes.css`). Omit for icons with
   * no solid counterpart — they then always render `node`, unchanged.
   */
  solid?: ReactNode;
}

/**
 * Factory for declaring a sample icon from its inner SVG nodes while keeping
 * a single, consistent visual style. Returns a typed component.
 */
export function createIcon(node: ReactNode, displayName: string, options?: CreateIconOptions) {
  const solid = options?.solid;
  const Component = forwardRef<SVGSVGElement, IconProps>(function BrandIcon(
    { variant, ...props },
    ref,
  ) {
    // No solid glyph declared: render exactly as before, regardless of
    // `variant` — byte-identical DOM for every existing icon.
    let content: ReactNode = node;
    if (solid) {
      if (variant === "outline") {
        content = node;
      } else if (variant === "solid") {
        content = (
          <g fill="currentColor" stroke="none">
            {solid}
          </g>
        );
      } else {
        content = (
          <>
            <g data-icon-glyph="outline">{node}</g>
            <g data-icon-glyph="solid" fill="currentColor" stroke="none">
              {solid}
            </g>
          </>
        );
      }
    }
    return (
      <Icon ref={ref} {...props}>
        {content}
      </Icon>
    );
  });
  Component.displayName = displayName;
  return Component;
}
