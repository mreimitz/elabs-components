import { forwardRef, type HTMLAttributes } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/cn";

export const alertVariants = cva(
  "relative w-full rounded-lg border px-4 py-3 text-sm [&>svg]:absolute [&>svg]:start-4 [&>svg]:top-4 [&>svg]:size-4 [&>svg]:text-current [&>svg~*]:ps-7",
  {
    variants: {
      variant: {
        default: "bg-card text-card-foreground",
        info: "border-info/40 bg-info/10 text-foreground",
        success: "border-success/40 bg-success/10 text-foreground",
        warning: "border-warning/50 bg-warning/10 text-foreground",
        destructive:
          "border-destructive/40 bg-destructive/10 text-destructive [&>svg]:text-destructive",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

export const Alert = forwardRef<
  HTMLDivElement,
  HTMLAttributes<HTMLDivElement> & VariantProps<typeof alertVariants>
>(function Alert(
  // `role` is an explicit override seam (default "alert"): a PENDING decision
  // containing focusable controls (e.g. @elabs/components-ai ApprovalCard) must be a
  // labelled region (`role="group"` + aria-labelledby), not an assertive live
  // region (research/structural-design/11 §B.3).
  { className, variant, role = "alert", ...props },
  ref,
) {
  return (
    <div ref={ref} role={role} className={cn(alertVariants({ variant }), className)} {...props} />
  );
});

export interface AlertTitleProps extends HTMLAttributes<HTMLHeadingElement> {
  /**
   * Render at a different heading level to fit the surrounding document
   * outline (#329). The visual (`mb-1 font-medium leading-none
   * tracking-tight`) is identical at every level. @default "h5"
   */
  as?: "h1" | "h2" | "h3" | "h4" | "h5" | "h6";
}

// Ref type matches the rendered element (`HTMLHeadingElement` for every `as`
// value) — previously mismatched to `HTMLParagraphElement` (#329).
export const AlertTitle = forwardRef<HTMLHeadingElement, AlertTitleProps>(function AlertTitle(
  { className, as: Tag = "h5", ...props },
  ref,
) {
  return (
    <Tag
      ref={ref}
      className={cn("mb-1 font-medium leading-none tracking-tight", className)}
      {...props}
    />
  );
});

export interface AlertDescriptionProps extends HTMLAttributes<HTMLParagraphElement> {
  /**
   * Cap the line length to a readable prose measure (`max-w-prose`, ~65ch)
   * for genuine paragraph content (#339). Off by default — short,
   * label-style descriptions should stay full width.
   */
  measure?: boolean;
}

// NOTE (#329 AC): checked for the same ref-type mismatch as `AlertTitle` —
// `AlertDescription` renders a `<div>`, not a heading, so it needs no `as`
// heading seam. Its own generic (`HTMLParagraphElement` on a rendered `<div>`)
// is a pre-existing, unrelated mismatch; left as-is (out of scope for #329,
// which is scoped to heading semantics, and not requested by #339 either) to
// avoid a ref-type change unrelated to either issue's acceptance criteria.
export const AlertDescription = forwardRef<HTMLParagraphElement, AlertDescriptionProps>(
  function AlertDescription({ className, measure, ...props }, ref) {
    return (
      <div
        ref={ref}
        className={cn(
          "text-sm [&_p]:leading-relaxed text-muted-foreground",
          measure && "max-w-prose",
          className,
        )}
        {...props}
      />
    );
  },
);
