/**
 * Help Center page — for a help center / support landing page.
 *
 * What it shows a copier: The help center landing: search with suggestions, categories with article counts, popular articles, the status/community/contact links, and the contact form for what the articles do not answer.
 * Every block is a copy-own registry item; the frame (`SiteFrame`) is the navbar, one `<main>`
 * landmark and the footer. Swap a block, keep the route.
 */
import { SiteFrame } from "@/components/site-frame/site-frame";
import { HelpCenter } from "@/components/help-center-01/help-center";
import { MarketingContact } from "@/components/marketing-contact-01/marketing-contact";

export interface HelpCenterPageProps {
  /** Wordmark in the navbar and footer. */
  productName?: string;
}

export default function HelpCenterPage({ productName = "Harbourline" }: HelpCenterPageProps) {
  return (
    <SiteFrame productName={productName} activeHref="#docs">
      <HelpCenter />
      <MarketingContact />
    </SiteFrame>
  );
}
