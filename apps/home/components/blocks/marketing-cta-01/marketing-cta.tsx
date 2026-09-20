// registry: marketing-cta-01 — copied 2026-09-19
import type { ReactNode } from "react";
import { CTASection } from "@elabs-ai/components-marketing";
import { Button } from "@elabs-ai/components-ui";

export interface MarketingCtaProps {
  title?: ReactNode;
  description?: ReactNode;
  primaryLabel?: string;
  primaryHref?: string;
  secondaryLabel?: string;
  secondaryHref?: string;
  /** What is true about the offer, under the buttons. */
  reassurance?: ReactNode;
}

/** The closing ask: one thing to do, one quieter alternative, and what it costs to try. */
export function MarketingCta({
  title = "Plan tomorrow's routes tonight",
  description = "Import last week's orders and see the plan we would have made. It takes about ten minutes.",
  primaryLabel = "Start free",
  primaryHref = "#register",
  secondaryLabel = "Book a walkthrough",
  secondaryHref = "#contact",
  reassurance = "Fourteen days free · no card · export everything any time",
}: MarketingCtaProps) {
  return (
    <section className="mx-auto w-full max-w-7xl px-4 py-16" data-slot="marketing-cta">
      <CTASection
        actions={
          <>
            <Button asChild size="lg">
              <a href={primaryHref}>{primaryLabel}</a>
            </Button>
            <Button asChild size="lg" variant="outline">
              <a href={secondaryHref}>{secondaryLabel}</a>
            </Button>
          </>
        }
        description={
          <>
            {description}
            {reassurance ? (
              <span className="mt-3 block text-meta text-muted-foreground">{reassurance}</span>
            ) : null}
          </>
        }
        title={title}
      />
    </section>
  );
}
