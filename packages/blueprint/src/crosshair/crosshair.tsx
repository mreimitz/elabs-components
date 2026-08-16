import { forwardRef, type SVGProps } from "react";
import { cn } from "@elabs/components-ui/lib/cn";

export interface CrosshairProps extends SVGProps<SVGSVGElement> {
  /** Width & height in px. @default 16 */
  size?: number;
  /** Center break (gap) in px. @default 4 */
  gap?: number;
}

/**
 * A small centering / alignment crosshair (a plus with a center break).
 * Decorative by default (aria-hidden) — pass `aria-label` to make it meaningful.
 */
export const Crosshair = forwardRef<SVGSVGElement, CrosshairProps>(function Crosshair(
  { size = 16, gap = 4, className, role, "aria-label": ariaLabel, ...props },
  ref,
) {
  const c = size / 2;
  const g = gap / 2;
  const decorative = !ariaLabel && !role;
  return (
    <svg
      ref={ref}
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      fill="none"
      strokeWidth={1}
      className={cn("stroke-rule", className)}
      role={decorative ? undefined : (role ?? "img")}
      aria-hidden={decorative ? true : undefined}
      aria-label={ariaLabel}
      focusable="false"
      {...props}
    >
      <line x1={0} y1={c} x2={c - g} y2={c} />
      <line x1={c + g} y1={c} x2={size} y2={c} />
      <line x1={c} y1={0} x2={c} y2={c - g} />
      <line x1={c} y1={c + g} x2={c} y2={size} />
    </svg>
  );
});

export type RegistrationMarkVariant = "target" | "corner";

export interface RegistrationMarkProps extends SVGProps<SVGSVGElement> {
  /** Width & height in px. @default 24 */
  size?: number;
  /** "target" = ring + crosshair; "corner" = L-bracket. @default "target" */
  variant?: RegistrationMarkVariant;
}

/**
 * Printer's registration / reprographic mark — the classic alignment target
 * (ring + crosshair) or a corner L-bracket. Pure decoration (aria-hidden).
 */
export const RegistrationMark = forwardRef<SVGSVGElement, RegistrationMarkProps>(
  function RegistrationMark({ size = 24, variant = "target", className, ...props }, ref) {
    const c = size / 2;
    const r = size * 0.28;
    const t = size * 0.32;
    return (
      <svg
        ref={ref}
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        fill="none"
        strokeWidth={1}
        className={cn("stroke-rule", className)}
        aria-hidden
        focusable="false"
        {...props}
      >
        {variant === "target" ? (
          <>
            <circle cx={c} cy={c} r={r} />
            <line x1={c} y1={0} x2={c} y2={size} />
            <line x1={0} y1={c} x2={size} y2={c} />
          </>
        ) : (
          <>
            <path d={`M0 ${t} V0 H${t}`} />
            <line x1={0} y1={c} x2={size * 0.16} y2={c} />
            <line x1={c} y1={0} x2={c} y2={size * 0.16} />
          </>
        )}
      </svg>
    );
  },
);
