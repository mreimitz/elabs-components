import { type ReactNode } from "react";
import { Card, CardContent } from "@qlik-coe-emea/qlabs-components-ui";
import { cn } from "@qlik-coe-emea/qlabs-components-ui/lib/cn";

export interface UseCaseCardProps {
  title: ReactNode;
  description: ReactNode;
  icon?: ReactNode;
  /** Optional eyebrow / category. */
  tag?: ReactNode;
  /** Footer link/CTA. */
  footer?: ReactNode;
  className?: string;
}

/** Card highlighting an industry/use-case. Good for presales pages. */
export function UseCaseCard({
  title,
  description,
  icon,
  tag,
  footer,
  className,
}: UseCaseCardProps) {
  return (
    <Card interactive className={cn("h-full", className)}>
      <CardContent className="flex h-full flex-col gap-3 p-6">
        {icon ? (
          <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary [&_svg]:size-5">
            {icon}
          </div>
        ) : null}
        {tag ? (
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {tag}
          </span>
        ) : null}
        <h3 className="text-lg font-semibold text-foreground">{title}</h3>
        <p className="flex-1 text-sm text-muted-foreground">{description}</p>
        {/* #399 — footer copy is TEXT on the card, so it takes the on-surface
            `-text` rung; the icon tile above keeps the `text-primary` fill. */}
        {footer ? <div className="pt-1 text-sm font-medium text-primary-text">{footer}</div> : null}
      </CardContent>
    </Card>
  );
}
