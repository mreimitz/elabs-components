import { type ReactNode } from "react";
import { Reveal } from "@elabs/components-ui";
import { cn } from "@elabs/components-ui/lib/cn";

export interface CTASectionProps {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  /** Reveal the band on mount. Motion-gated. Defaults to true. */
  animate?: boolean;
  className?: string;
}

/** Closing call-to-action band with a subtle branded surface. */
export function CTASection({
  title,
  description,
  actions,
  animate = true,
  className,
}: CTASectionProps) {
  const section = (
    <section
      className={cn(
        "mx-auto flex max-w-5xl flex-col items-center gap-5 rounded-3xl bg-primary px-8 py-14 text-center text-primary-foreground",
        className,
      )}
    >
      <h2 className="text-balance text-3xl font-semibold tracking-tight">{title}</h2>
      {description ? (
        // Inherit `color` from the `.bg-primary` section root, exactly like the
        // heading above — do NOT re-declare `text-primary-foreground` (or any
        // alpha-faded companion-token utility) here. decoration.css's high-decoration
        // ink override only re-inks elements that themselves carry `.bg-primary`;
        // a descendant that sets its own `-foreground` class silently steps
        // outside that contract and stops being re-inked (#393).
        <p className="max-w-2xl text-base">{description}</p>
      ) : null}
      {actions ? <div className="flex flex-wrap justify-center gap-3">{actions}</div> : null}
    </section>
  );

  if (!animate) {
    return section;
  }

  return (
    <Reveal appear="up" speed="slow">
      {section}
    </Reveal>
  );
}
