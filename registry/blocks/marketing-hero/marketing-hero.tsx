/**
 * Marketing hero scaffold (copy-owned block).
 * Depends on installed @elabs-ai/components-marketing + @elabs-ai/components-ui.
 */
import { Button } from "@elabs-ai/components-ui";
import { Hero, LogoStrip } from "@elabs-ai/components-marketing";

export function MarketingHero() {
  return (
    <div className="space-y-12">
      <Hero
        eyebrow="Announcing"
        title="Your product, in one clear sentence"
        description="A concise value proposition that tells visitors exactly what they get."
        actions={
          <>
            <Button>Start free</Button>
            <Button variant="outline">Book a demo</Button>
          </>
        }
      />
      <LogoStrip
        logos={[
          <span key="1" className="text-lg font-semibold">
            Acme
          </span>,
          <span key="2" className="text-lg font-semibold">
            Globex
          </span>,
          <span key="3" className="text-lg font-semibold">
            Initech
          </span>,
          <span key="4" className="text-lg font-semibold">
            Umbrella
          </span>,
        ]}
      />
    </div>
  );
}
