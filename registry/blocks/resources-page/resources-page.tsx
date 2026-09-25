/**
 * Resources page — for a resources library page.
 *
 * What it shows a copier: The resources library: a featured guide, resources filterable by type (guide, webinar, template, report), and the newsletter to be told about the next one.
 * Every block is a copy-own registry item; the frame (`SiteFrame`) is the navbar, one `<main>`
 * landmark and the footer. Swap a block, keep the route.
 */
import { SiteFrame } from "@/components/site-frame/site-frame";
import { MarketingNewsletter } from "@/components/marketing-newsletter-01/marketing-newsletter";
import { Resources } from "@/components/resources-01/resources";

export interface ResourcesPageProps {
  /** Wordmark in the navbar and footer. */
  productName?: string;
}

export default function ResourcesPage({ productName = "Harbourline" }: ResourcesPageProps) {
  return (
    <SiteFrame productName={productName} activeHref="#docs">
      <Resources />
      <MarketingNewsletter />
    </SiteFrame>
  );
}
