/**
 * Features page — for a long-form features page.
 *
 * What it shows a copier: The features page: an alternating showcase of copy and product, tabs that switch the product screen, the bento grid for the smaller capabilities, the process in steps and the closing CTA.
 * Every block is a copy-own registry item; the frame (`SiteFrame`) is the navbar, one `<main>`
 * landmark and the footer. Swap a block, keep the route.
 */
import { SiteFrame } from "@/components/site-frame/site-frame";
import { MarketingBento } from "@/components/marketing-bento-01/marketing-bento";
import { MarketingCta } from "@/components/marketing-cta-01/marketing-cta";
import { MarketingFeatureShowcase } from "@/components/marketing-features-02/marketing-feature-showcase";
import { MarketingFeatureTabs } from "@/components/marketing-features-03/marketing-feature-tabs";
import { MarketingProcess } from "@/components/marketing-process-01/marketing-process";

export interface FeaturesPageProps {
  /** Wordmark in the navbar and footer. */
  productName?: string;
}

export default function FeaturesPage({ productName = "Harbourline" }: FeaturesPageProps) {
  return (
    <SiteFrame productName={productName} activeHref="#product">
      <h1 className="sr-only">Features</h1>
      <MarketingFeatureShowcase />
      <MarketingFeatureTabs />
      <MarketingBento />
      <MarketingProcess />
      <MarketingCta />
    </SiteFrame>
  );
}
