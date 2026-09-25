/**
 * Marketing hero scaffold (copy-owned block).
 * Depends on installed @elabs-ai/components-marketing + @elabs-ai/components-ui.
 */
import type { ReactNode } from "react";
import { Button, cn } from "@elabs-ai/components-ui";
import { Hero, LogoStrip } from "@elabs-ai/components-marketing";

export interface MarketingHeroCta {
  label: string;
  href: string;
}

export interface MarketingHeroProps {
  /** Small label above the headline. */
  eyebrow?: ReactNode;
  title?: ReactNode;
  description?: ReactNode;
  primaryCta?: MarketingHeroCta;
  /** Pass `null` for a single call to action. */
  secondaryCta?: MarketingHeroCta | null;
  /**
   * Customer wordmarks under the hero — plain names are set as text marks. Pass an empty
   * array to leave the strip out.
   */
  logos?: (string | ReactNode)[];
  className?: string;
}

const DEFAULT_LOGOS = ["Acme", "Globex", "Initech", "Umbrella"];

const wordmark = (logo: string | ReactNode, index: number) =>
  typeof logo === "string" ? (
    <span className="text-subtitle font-semibold" key={logo}>
      {logo}
    </span>
  ) : (
    <span key={index}>{logo}</span>
  );

export function MarketingHero({
  eyebrow = "Announcing",
  title = "Your product, in one clear sentence",
  description = "A concise value proposition that tells visitors exactly what they get.",
  primaryCta = { label: "Start free", href: "#register" },
  secondaryCta = { label: "Book a demo", href: "#demo" },
  logos = DEFAULT_LOGOS,
  className,
}: MarketingHeroProps = {}) {
  return (
    <div className={cn("space-y-12", className)} data-slot="marketing-hero">
      <Hero
        eyebrow={eyebrow}
        title={title}
        description={description}
        actions={
          <>
            <Button asChild>
              <a href={primaryCta.href}>{primaryCta.label}</a>
            </Button>
            {secondaryCta ? (
              <Button asChild variant="outline">
                <a href={secondaryCta.href}>{secondaryCta.label}</a>
              </Button>
            ) : null}
          </>
        }
      />
      {logos.length ? <LogoStrip logos={logos.map(wordmark)} /> : null}
    </div>
  );
}
