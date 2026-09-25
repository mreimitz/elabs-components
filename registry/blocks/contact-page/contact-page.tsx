/**
 * Contact page — for a contact page.
 *
 * What it shows a copier: The contact page: the contact form with a topic picker and the other ways to reach the company, the FAQ that answers the question before it is asked, and the newsletter for people who are not ready yet.
 * Every block is a copy-own registry item; the frame (`SiteFrame`) is the navbar, one `<main>`
 * landmark and the footer. Swap a block, keep the route.
 */
import { SiteFrame } from "@/components/site-frame/site-frame";
import { MarketingContact } from "@/components/marketing-contact-01/marketing-contact";
import { MarketingFaq } from "@/components/marketing-faq-01/marketing-faq";
import { MarketingNewsletter } from "@/components/marketing-newsletter-01/marketing-newsletter";

export interface ContactPageProps {
  /** Wordmark in the navbar and footer. */
  productName?: string;
}

export default function ContactPage({ productName = "Harbourline" }: ContactPageProps) {
  return (
    <SiteFrame productName={productName} activeHref="#customers">
      <h1 className="sr-only">Contact</h1>
      <MarketingContact />
      <MarketingFaq />
      <MarketingNewsletter />
    </SiteFrame>
  );
}
