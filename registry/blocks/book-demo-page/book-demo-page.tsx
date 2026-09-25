/**
 * Talk to Sales page — for a talk-to-sales page with a bookable walkthrough.
 *
 * What it shows a copier: The talk-to-sales page: the booking form with the walkthrough agenda, hosts and time slots, the logo strip and a testimonial spotlight underneath for the person who is still deciding.
 * Every block is a copy-own registry item; the frame (`SiteFrame`) is the navbar, one `<main>`
 * landmark and the footer. Swap a block, keep the route.
 */
import { SiteFrame } from "@/components/site-frame/site-frame";
import { MarketingBookDemo } from "@/components/marketing-book-demo-01/marketing-book-demo";
import { MarketingLogos } from "@/components/marketing-logos-01/marketing-logos";
import { MarketingTestimonialSpotlight } from "@/components/marketing-testimonials-02/marketing-testimonial-spotlight";

export interface BookDemoPageProps {
  /** Wordmark in the navbar and footer. */
  productName?: string;
}

export default function BookDemoPage({ productName = "Harbourline" }: BookDemoPageProps) {
  return (
    <SiteFrame productName={productName} activeHref="#customers">
      <h1 className="sr-only">Talk to sales</h1>
      <MarketingBookDemo />
      <MarketingLogos />
      <MarketingTestimonialSpotlight />
    </SiteFrame>
  );
}
