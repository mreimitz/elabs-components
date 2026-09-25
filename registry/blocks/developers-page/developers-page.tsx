/**
 * Developers page — for a developer-facing landing page: install, code, integrate.
 *
 * What it shows a copier: The developer landing page: a code-first hero with install commands and switchable snippets, the process in three steps, the integrations wall, the trust and security band and a CTA banner — the page a developer reads before opening the docs.
 * Every block is a copy-own registry item; the frame (`SiteFrame`) is the navbar, one `<main>`
 * landmark and the footer. Swap a block, keep the route.
 */
import { SiteFrame } from "@/components/site-frame/site-frame";
import { MarketingCodeExample } from "@/components/marketing-code-example-01/marketing-code-example";
import { MarketingCtaBanner } from "@/components/marketing-cta-02/marketing-cta-banner";
import { MarketingIntegrations } from "@/components/marketing-integrations-01/marketing-integrations";
import { MarketingProcess } from "@/components/marketing-process-01/marketing-process";
import { MarketingTrust } from "@/components/marketing-trust-01/marketing-trust";

export interface DevelopersPageProps {
  /** Wordmark in the navbar and footer. */
  productName?: string;
}

export default function DevelopersPage({ productName = "Harbourline" }: DevelopersPageProps) {
  return (
    <SiteFrame productName={productName} activeHref="#docs">
      <MarketingCodeExample />
      <MarketingProcess />
      <MarketingIntegrations />
      <MarketingTrust />
      <MarketingCtaBanner />
    </SiteFrame>
  );
}
