import type { MetadataRoute } from "next";
import { HOSTED_DOCS_URL } from "@elabs-ai/components-cli/lib/render-docs.mjs";

// `/storybook/` keeps its own project's `robots.txt`/sitemap for the docs pages themselves —
// this lists the site's own routes plus the one Storybook entry point an agent should land on.
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${HOSTED_DOCS_URL}/`, changeFrequency: "weekly", priority: 1 },
    { url: `${HOSTED_DOCS_URL}/llms.txt`, changeFrequency: "weekly", priority: 0.8 },
    { url: `${HOSTED_DOCS_URL}/storybook/`, changeFrequency: "weekly", priority: 0.6 },
  ];
}
