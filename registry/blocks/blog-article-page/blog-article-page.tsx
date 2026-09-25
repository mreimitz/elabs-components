/**
 * Blog Article page — for a single blog post.
 *
 * What it shows a copier: A single blog article: the post with its table of contents, author, share controls, related posts and an inline subscribe — the reading page of the blog.
 * Every block is a copy-own registry item; the frame (`SiteFrame`) is the navbar, one `<main>`
 * landmark and the footer. Swap a block, keep the route.
 */
import { SiteFrame } from "@/components/site-frame/site-frame";
import { BlogPost } from "@/components/blog-post-01/blog-post";

export interface BlogArticlePageProps {
  /** Wordmark in the navbar and footer. */
  productName?: string;
}

export default function BlogArticlePage({ productName = "Harbourline" }: BlogArticlePageProps) {
  return (
    <SiteFrame productName={productName} activeHref="#blog">
      <BlogPost />
    </SiteFrame>
  );
}
