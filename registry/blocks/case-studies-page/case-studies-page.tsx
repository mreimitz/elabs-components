/**
 * Case Studies page — for a customers / case-studies index page.
 *
 * What it shows a copier: The customers page: the wall of case studies filterable by industry, the big-number outcomes, a logo strip and the closing CTA.
 * Every block is a copy-own registry item; the frame (`SiteFrame`) is the navbar, one `<main>`
 * landmark and the footer. Swap a block, keep the route.
 */
import { SiteFrame } from "@/components/site-frame/site-frame";
import { CaseStudies } from "@/components/case-studies-01/case-studies";
import { MarketingCta } from "@/components/marketing-cta-01/marketing-cta";
import { MarketingLogos } from "@/components/marketing-logos-01/marketing-logos";
import { MarketingStatsBig } from "@/components/marketing-stats-02/marketing-stats-big";

export interface CaseStudiesPageProps {
  /** Wordmark in the navbar and footer. */
  productName?: string;
}

export default function CaseStudiesPage({ productName = "Harbourline" }: CaseStudiesPageProps) {
  return (
    <SiteFrame productName={productName} activeHref="#customers">
      <h1 className="sr-only">Customers</h1>
      <CaseStudies />
      <MarketingStatsBig />
      <MarketingLogos />
      <MarketingCta />
    </SiteFrame>
  );
}
