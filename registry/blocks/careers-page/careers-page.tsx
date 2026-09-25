/**
 * Careers page — for a careers page with open roles.
 *
 * What it shows a copier: The careers page: the values that make the pitch, the open roles grouped by team with a leave-your-details fallback, the team grid, and testimonials from the people who work there.
 * Every block is a copy-own registry item; the frame (`SiteFrame`) is the navbar, one `<main>`
 * landmark and the footer. Swap a block, keep the route.
 */
import { SiteFrame } from "@/components/site-frame/site-frame";
import { Careers } from "@/components/careers-01/careers";
import { MarketingTeam } from "@/components/marketing-team-01/marketing-team";
import { MarketingTestimonials } from "@/components/marketing-testimonials-01/marketing-testimonials";

export interface CareersPageProps {
  /** Wordmark in the navbar and footer. */
  productName?: string;
}

export default function CareersPage({ productName = "Harbourline" }: CareersPageProps) {
  return (
    <SiteFrame productName={productName} activeHref="#customers">
      <Careers />
      <MarketingTeam />
      <MarketingTestimonials />
    </SiteFrame>
  );
}
