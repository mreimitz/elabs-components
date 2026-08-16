import { forwardRef, type HTMLAttributes, type ReactNode } from "react";
import { cn } from "@qlik-coe-emea/qlabs-components-ui/lib/cn";
import { RegistrationMark } from "../crosshair";

export interface BlueprintSheetProps extends HTMLAttributes<HTMLDivElement> {
  /** The single title block for the sheet, docked at the bottom edge. */
  titleBlock?: ReactNode;
  /** Draw corner registration ticks at the sheet edges. @default true */
  corners?: boolean;
  /** Show a registration mark in the top-right. @default false */
  registrationMark?: boolean;
  /** Accessible name for the sheet. */
  label?: string;
  children: ReactNode;
}

function SheetCorners() {
  const base = "pointer-events-none absolute size-4 border-rule-strong";
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 z-20">
      <span className={cn(base, "left-2 top-2 border-l-2 border-t-2")} />
      <span className={cn(base, "right-2 top-2 border-r-2 border-t-2")} />
      <span className={cn(base, "bottom-2 left-2 border-b-2 border-l-2")} />
      <span className={cn(base, "bottom-2 right-2 border-b-2 border-r-2")} />
    </div>
  );
}

/**
 * The page-level "drawing sheet" — the ONE place the blueprint frame lives
 * (corner registration ticks + a single title block + optional registration
 * mark). Wrap a whole screen in exactly one `BlueprintSheet`; inner panels must
 * NOT repeat the frame. The graph-paper ground comes from the theme, so this
 * adds only the frame furniture. See `.claude/rules/blueprint-decoration.md`.
 */
export const BlueprintSheet = forwardRef<HTMLDivElement, BlueprintSheetProps>(
  function BlueprintSheet(
    { titleBlock, corners = true, registrationMark = false, label, className, children, ...props },
    ref,
  ) {
    return (
      <div
        ref={ref}
        data-slot="blueprint-sheet"
        role="group"
        aria-label={label}
        className={cn("relative flex min-h-full flex-col", className)}
        {...props}
      >
        {corners ? <SheetCorners /> : null}
        {registrationMark ? (
          <RegistrationMark className="absolute right-4 top-4 z-20" size={22} />
        ) : null}
        <div className="relative z-10 flex-1">{children}</div>
        {titleBlock ? <div className="relative z-10 border-t border-rule">{titleBlock}</div> : null}
      </div>
    );
  },
);
