/**
 * Checkout page — for the checkout route of a store.
 *
 * What it shows a copier: The checkout page: contact, delivery, payment and the order summary in the site frame with the trust band below it — the last page before the order.
 * Every block is a copy-own registry item; the frame (`SiteFrame`) is the navbar, one `<main>`
 * landmark and the footer. Swap a block, keep the route.
 */
import { SectionHeader } from "@elabs-ai/components-ui";
import { SiteFrame } from "@/components/site-frame/site-frame";
import { Checkout } from "@/components/checkout-01/checkout";
import { MarketingTrust } from "@/components/marketing-trust-01/marketing-trust";

export interface CheckoutPageProps {
  /** Wordmark in the navbar and footer. */
  productName?: string;
}

export default function CheckoutPage({ productName = "Harbourline" }: CheckoutPageProps) {
  return (
    <SiteFrame productName={productName}>
      <div className="mx-auto w-full max-w-7xl px-4 py-16 flex flex-col gap-8">
        <SectionHeader as="h1" size="lg" title="Checkout" />
        <Checkout />
      </div>
      <MarketingTrust />
    </SiteFrame>
  );
}
