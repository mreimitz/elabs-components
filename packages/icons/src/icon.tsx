import { forwardRef, type SVGProps } from "react";

export interface IconProps extends SVGProps<SVGSVGElement> {
  /** Pixel size for both width & height. Defaults to 24. */
  size?: number | string;
  /**
   * Accessible name. When provided the icon is exposed to AT as an image;
   * when omitted the icon is treated as decorative (aria-hidden).
   */
  title?: string;
}

/**
 * Generic, brand-consistent SVG wrapper. All sample icons render through this
 * so stroke width, line caps, sizing and accessibility stay uniform. Color is
 * inherited via `currentColor`, so icons theme automatically with text color.
 */
export const Icon = forwardRef<SVGSVGElement, IconProps>(function Icon(
  { size = 24, title, children, strokeWidth = 2, ...props },
  ref,
) {
  const decorative = !title;
  return (
    <svg
      ref={ref}
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

/**
 * Factory for declaring a sample icon from its inner SVG nodes while keeping
 * a single, consistent visual style. Returns a typed component.
 */
export function createIcon(node: React.ReactNode, displayName: string) {
  const Component = forwardRef<SVGSVGElement, IconProps>(function BrandIcon(props, ref) {
    return (
      <Icon ref={ref} {...props}>
        {node}
      </Icon>
    );
  });
  Component.displayName = displayName;
  return Component;
}
