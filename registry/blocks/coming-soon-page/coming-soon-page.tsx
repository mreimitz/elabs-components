/**
 * Coming Soon page — for a pre-launch / waitlist page.
 *
 * What it shows a copier: The pre-launch page: an email-first hero with benefits and social proof, the waitlist with its milestones, and a preview of the features to come.
 * Every block is a copy-own registry item; the frame (`SiteFrame`) is the navbar, one `<main>`
 * landmark and the footer. Swap a block, keep the route.
 */
import { SiteFrame } from "@/components/site-frame/site-frame";
import { MarketingFeatures } from "@/components/marketing-features-01/marketing-features";
import { MarketingHeroSignup } from "@/components/marketing-hero-03/marketing-hero-signup";
import { MarketingWaitlist } from "@/components/marketing-waitlist-01/marketing-waitlist";

export interface ComingSoonPageProps {
  /** Wordmark in the navbar and footer. */
  productName?: string;
}

export default function ComingSoonPage({ productName = "Harbourline" }: ComingSoonPageProps) {
  return (
    <SiteFrame productName={productName} activeHref="#product">
      <MarketingHeroSignup />
      <MarketingWaitlist />
      <MarketingFeatures columns={3} />
    </SiteFrame>
  );
}
