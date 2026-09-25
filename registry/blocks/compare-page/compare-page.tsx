/**
 * Compare page — for a versus / alternative-to page.
 *
 * What it shows a copier: The comparison page: a side-by-side table against the alternatives with a best-for row, testimonials from people who switched, the FAQ and the closing CTA.
 * Every block is a copy-own registry item; the frame (`SiteFrame`) is the navbar, one `<main>`
 * landmark and the footer. Swap a block, keep the route.
 */
import { SiteFrame } from "@/components/site-frame/site-frame";
import { MarketingCompare } from "@/components/marketing-compare-01/marketing-compare";
import { MarketingCta } from "@/components/marketing-cta-01/marketing-cta";
import { MarketingFaq } from "@/components/marketing-faq-01/marketing-faq";
import { MarketingTestimonials } from "@/components/marketing-testimonials-01/marketing-testimonials";

export interface ComparePageProps {
  /** Wordmark in the navbar and footer. */
  productName?: string;
}

export default function ComparePage({ productName = "Harbourline" }: ComparePageProps) {
  return (
    <SiteFrame productName={productName} activeHref="#product">
      <h1 className="sr-only">Compare</h1>
      <MarketingCompare />
      <MarketingTestimonials />
      <MarketingFaq />
      <MarketingCta />
    </SiteFrame>
  );
}
