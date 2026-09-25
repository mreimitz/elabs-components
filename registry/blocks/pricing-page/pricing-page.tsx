/**
 * Pricing page — for a pricing page with plans, a comparison table and an FAQ.
 *
 * What it shows a copier: The pricing page: the plan cards with a monthly/yearly toggle, the full feature-by-plan comparison table, testimonials for reassurance, the pricing FAQ and the closing CTA.
 * Every block is a copy-own registry item; the frame (`SiteFrame`) is the navbar, one `<main>`
 * landmark and the footer. Swap a block, keep the route.
 */
import { SiteFrame } from "@/components/site-frame/site-frame";
import { MarketingCta } from "@/components/marketing-cta-01/marketing-cta";
import { MarketingFaq } from "@/components/marketing-faq-01/marketing-faq";
import { MarketingPricing } from "@/components/marketing-pricing-01/marketing-pricing";
import { MarketingPricingCompare } from "@/components/marketing-pricing-02/marketing-pricing-compare";
import { MarketingTestimonials } from "@/components/marketing-testimonials-01/marketing-testimonials";

export interface PricingPageProps {
  /** Wordmark in the navbar and footer. */
  productName?: string;
}

export default function PricingPage({ productName = "Harbourline" }: PricingPageProps) {
  return (
    <SiteFrame productName={productName} activeHref="#pricing">
      <h1 className="sr-only">Pricing</h1>
      <MarketingPricing />
      <MarketingPricingCompare />
      <MarketingTestimonials />
      <MarketingFaq />
      <MarketingCta />
    </SiteFrame>
  );
}
