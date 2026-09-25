/**
 * Blog page — for a blog index page.
 *
 * What it shows a copier: The blog index: a filterable, paged list of posts with a featured post on top, and the newsletter signup below.
 * Every block is a copy-own registry item; the frame (`SiteFrame`) is the navbar, one `<main>`
 * landmark and the footer. Swap a block, keep the route.
 */
import { SiteFrame } from "@/components/site-frame/site-frame";
import { BlogList } from "@/components/blog-list-01/blog-list";
import { MarketingNewsletter } from "@/components/marketing-newsletter-01/marketing-newsletter";

export interface BlogPageProps {
  /** Wordmark in the navbar and footer. */
  productName?: string;
}

export default function BlogPage({ productName = "Harbourline" }: BlogPageProps) {
  return (
    <SiteFrame productName={productName} activeHref="#blog">
      <BlogList />
      <MarketingNewsletter />
    </SiteFrame>
  );
}
