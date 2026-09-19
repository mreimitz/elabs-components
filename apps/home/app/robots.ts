import type { MetadataRoute } from "next";
import { HOSTED_DOCS_URL } from "@elabs-ai/components-cli/lib/render-docs.mjs";

// Allow everything (concept §6 "Agent surface on the site"); Storybook (`/storybook/`) keeps
// serving its own `robots.txt` at its own origin — this file only covers the site's routes.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/" },
    sitemap: `${HOSTED_DOCS_URL}/sitemap.xml`,
  };
}
