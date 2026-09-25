/**
 * Customer Story page — for a single customer story.
 *
 * What it shows a copier: A single customer story: the headline outcome, the customer's facts, the challenge/solution/results narrative with pull quotes, before-and-after numbers and the CTA to talk to sales.
 * Every block is a copy-own registry item; the frame (`SiteFrame`) is the navbar, one `<main>`
 * landmark and the footer. Swap a block, keep the route.
 */
import { SiteFrame } from "@/components/site-frame/site-frame";
import { CustomerStory } from "@/components/customer-story-01/customer-story";

export interface CustomerStoryPageProps {
  /** Wordmark in the navbar and footer. */
  productName?: string;
}

export default function CustomerStoryPage({ productName = "Harbourline" }: CustomerStoryPageProps) {
  return (
    <SiteFrame productName={productName} activeHref="#customers">
      <CustomerStory />
    </SiteFrame>
  );
}
