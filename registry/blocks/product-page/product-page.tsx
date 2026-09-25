/**
 * Product page — for a product detail page of a store.
 *
 * What it shows a copier: The product page: gallery, options, price and add-to-cart in the site frame, then the reviews with their rating breakdown and a review form, and the newsletter.
 * Every block is a copy-own registry item; the frame (`SiteFrame`) is the navbar, one `<main>`
 * landmark and the footer. Swap a block, keep the route.
 */
import { SiteFrame } from "@/components/site-frame/site-frame";
import { MarketingNewsletter } from "@/components/marketing-newsletter-01/marketing-newsletter";
import { ProductDetail } from "@/components/product-detail-01/product-detail";
import { ProductReviews } from "@/components/product-reviews-01/product-reviews";

export interface ProductPageProps {
  /** Wordmark in the navbar and footer. */
  productName?: string;
}

export default function ProductPage({ productName = "Harbourline" }: ProductPageProps) {
  return (
    <SiteFrame productName={productName} activeHref="#product">
      <div className="mx-auto w-full max-w-7xl px-4 py-16">
        <ProductDetail />
      </div>
      <ProductReviews />
      <MarketingNewsletter />
    </SiteFrame>
  );
}
