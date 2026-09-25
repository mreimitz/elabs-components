/**
 * About page — for a company about page.
 *
 * What it shows a copier: The about page: mission, story, milestones, values and numbers, the team grid, a careers teaser with open roles and the closing CTA.
 * Every block is a copy-own registry item; the frame (`SiteFrame`) is the navbar, one `<main>`
 * landmark and the footer. Swap a block, keep the route.
 */
import { SiteFrame } from "@/components/site-frame/site-frame";
import { AboutStory } from "@/components/about-story-01/about-story";
import { Careers } from "@/components/careers-01/careers";
import { MarketingCta } from "@/components/marketing-cta-01/marketing-cta";
import { MarketingTeam } from "@/components/marketing-team-01/marketing-team";

export interface AboutPageProps {
  /** Wordmark in the navbar and footer. */
  productName?: string;
}

export default function AboutPage({ productName = "Harbourline" }: AboutPageProps) {
  return (
    <SiteFrame productName={productName} activeHref="#customers">
      <AboutStory />
      <MarketingTeam />
      <Careers titleAs="h2" />
      <MarketingCta />
    </SiteFrame>
  );
}
