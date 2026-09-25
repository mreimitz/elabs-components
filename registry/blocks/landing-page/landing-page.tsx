/**
 * Landing page — for the front door of a SaaS product.
 *
 * What it shows a copier: The classic marketing landing page: a release banner, the hero with its logo strip, the feature grid, a showcase that alternates copy and product, the stats band, testimonials, the pricing table, an FAQ and the closing CTA — with a cookie banner that stays out of the way until it is answered.
 * Every block is a copy-own registry item; the frame (`SiteFrame`) is the navbar, one `<main>`
 * landmark and the footer. Swap a block, keep the route.
 */
import { SiteFrame } from "@/components/site-frame/site-frame";
import { MarketingBanner } from "@/components/marketing-banner-01/marketing-banner";
import { MarketingCookieBanner } from "@/components/marketing-cookie-banner-01/marketing-cookie-banner";
import { MarketingCta } from "@/components/marketing-cta-01/marketing-cta";
import { MarketingFaq } from "@/components/marketing-faq-01/marketing-faq";
import { MarketingFeatureShowcase } from "@/components/marketing-features-02/marketing-feature-showcase";
import { MarketingFeatures } from "@/components/marketing-features-01/marketing-features";
import { MarketingHero } from "@/components/marketing-hero/marketing-hero";
import { MarketingPricing } from "@/components/marketing-pricing-01/marketing-pricing";
import { MarketingStats } from "@/components/marketing-stats-01/marketing-stats";
import { MarketingTestimonials } from "@/components/marketing-testimonials-01/marketing-testimonials";

export interface LandingPageProps {
  /** Wordmark in the navbar and footer. */
  productName?: string;
}

export default function LandingPage({ productName = "Harbourline" }: LandingPageProps) {
  return (
    <SiteFrame
      productName={productName}
      activeHref="#product"
      banner={<MarketingBanner dismissible />}
      after={<MarketingCookieBanner placement="fixed" variant="compact" />}
    >
      <MarketingHero
        description="Plan tomorrow’s routes tonight, clear customs without the binder and see every parcel before the customer asks. The operations desk for the people who move containers."
        eyebrow="Logistics software"
        primaryCta={{ label: "Start free", href: "#register" }}
        secondaryCta={{ label: "Book a walkthrough", href: "#talk-to-sales" }}
        title="Built for the day nothing goes to plan"
      />
      <MarketingFeatures />
      <MarketingFeatureShowcase />
      <MarketingStats />
      <MarketingTestimonials />
      <MarketingPricing />
      <MarketingFaq />
      <MarketingCta />
    </SiteFrame>
  );
}
