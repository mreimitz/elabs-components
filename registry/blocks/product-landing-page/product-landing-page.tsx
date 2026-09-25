/**
 * Product Landing page — for a product-led landing page with the product in the hero.
 *
 * What it shows a copier: A product-led variant of the landing page: the hero shows the product itself with live metrics and a sparkline, a marquee logo strip, feature tabs that switch the product screen, the bento grid, the big-number stats band, a testimonial spotlight and a CTA banner with social proof.
 * Every block is a copy-own registry item; the frame (`SiteFrame`) is the navbar, one `<main>`
 * landmark and the footer. Swap a block, keep the route.
 */
import { SiteFrame } from "@/components/site-frame/site-frame";
import { MarketingBento } from "@/components/marketing-bento-01/marketing-bento";
import { MarketingCtaBanner } from "@/components/marketing-cta-02/marketing-cta-banner";
import { MarketingFeatureTabs } from "@/components/marketing-features-03/marketing-feature-tabs";
import { MarketingHeroProduct } from "@/components/marketing-hero-02/marketing-hero-product";
import { MarketingLogos } from "@/components/marketing-logos-01/marketing-logos";
import { MarketingStatsBig } from "@/components/marketing-stats-02/marketing-stats-big";
import { MarketingTestimonialSpotlight } from "@/components/marketing-testimonials-02/marketing-testimonial-spotlight";

export interface ProductLandingPageProps {
  /** Wordmark in the navbar and footer. */
  productName?: string;
}

export default function ProductLandingPage({
  productName = "Harbourline",
}: ProductLandingPageProps) {
  return (
    <SiteFrame productName={productName} activeHref="#product">
      <MarketingHeroProduct />
      <MarketingLogos layout="marquee" />
      <MarketingFeatureTabs />
      <MarketingBento />
      <MarketingStatsBig />
      <MarketingTestimonialSpotlight />
      <MarketingCtaBanner />
    </SiteFrame>
  );
}
