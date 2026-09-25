/**
 * Changelog page — for a product changelog page.
 *
 * What it shows a copier: The changelog: releases in reverse order, each with its typed changes, an RSS link and a subscribe form, followed by a CTA banner for readers who are not customers yet.
 * Every block is a copy-own registry item; the frame (`SiteFrame`) is the navbar, one `<main>`
 * landmark and the footer. Swap a block, keep the route.
 */
import { SiteFrame } from "@/components/site-frame/site-frame";
import { Changelog } from "@/components/changelog-01/changelog";
import { MarketingCtaBanner } from "@/components/marketing-cta-02/marketing-cta-banner";

export interface ChangelogPageProps {
  /** Wordmark in the navbar and footer. */
  productName?: string;
}

export default function ChangelogPage({ productName = "Harbourline" }: ChangelogPageProps) {
  return (
    <SiteFrame productName={productName} activeHref="#docs">
      <Changelog />
      <MarketingCtaBanner />
    </SiteFrame>
  );
}
