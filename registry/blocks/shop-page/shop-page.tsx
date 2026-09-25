/**
 * Shop page — for a storefront listing page.
 *
 * What it shows a copier: The shop page: the product grid with sort and quick add in the site frame, followed by the trust band and the newsletter.
 * Every block is a copy-own registry item; the frame (`SiteFrame`) is the navbar, one `<main>`
 * landmark and the footer. Swap a block, keep the route.
 */
import { SectionHeader } from "@elabs-ai/components-ui";
import { SiteFrame } from "@/components/site-frame/site-frame";
import { MarketingNewsletter } from "@/components/marketing-newsletter-01/marketing-newsletter";
import { MarketingTrust } from "@/components/marketing-trust-01/marketing-trust";
import { ProductGrid } from "@/components/product-grid-01/product-grid";

export interface ShopPageProps {
  /** Wordmark in the navbar and footer. */
  productName?: string;
}

export default function ShopPage({ productName = "Harbourline" }: ShopPageProps) {
  return (
    <SiteFrame productName={productName} activeHref="#product">
      <div className="mx-auto w-full max-w-7xl px-4 py-16 flex flex-col gap-8">
        <h1 className="sr-only">Shop</h1>
        <SectionHeader
          description="Everything we make, in stock and shipping this week."
          size="lg"
          title="All products"
        />
        <ProductGrid />
      </div>
      <MarketingTrust />
      <MarketingNewsletter />
    </SiteFrame>
  );
}
