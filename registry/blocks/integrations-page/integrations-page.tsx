/**
 * Integrations page — for an integrations directory page.
 *
 * What it shows a copier: The integrations page: a filterable wall of integration tiles with a request-an-integration link, the trust and security band that answers the data question, and a CTA banner.
 * Every block is a copy-own registry item; the frame (`SiteFrame`) is the navbar, one `<main>`
 * landmark and the footer. Swap a block, keep the route.
 */
import { SiteFrame } from "@/components/site-frame/site-frame";
import { MarketingCtaBanner } from "@/components/marketing-cta-02/marketing-cta-banner";
import { MarketingIntegrations } from "@/components/marketing-integrations-01/marketing-integrations";
import { MarketingTrust } from "@/components/marketing-trust-01/marketing-trust";

export interface IntegrationsPageProps {
  /** Wordmark in the navbar and footer. */
  productName?: string;
}

export default function IntegrationsPage({ productName = "Harbourline" }: IntegrationsPageProps) {
  return (
    <SiteFrame productName={productName} activeHref="#product">
      <h1 className="sr-only">Integrations</h1>
      <MarketingIntegrations />
      <MarketingTrust />
      <MarketingCtaBanner />
    </SiteFrame>
  );
}
