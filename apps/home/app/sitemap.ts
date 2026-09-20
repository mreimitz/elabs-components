import type { MetadataRoute } from "next";
import { HOSTED_DOCS_URL } from "@elabs-ai/components-cli/lib/render-docs.mjs";
import { CATALOG_INDEX, hrefOf } from "../lib/catalog-index";

// `/storybook/` keeps its own project's `robots.txt`/sitemap for the docs pages themselves —
// this lists the site's own routes plus the one Storybook entry point an agent should land on.
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${HOSTED_DOCS_URL}/`, changeFrequency: "weekly", priority: 1 },
    ...["/templates", "/blocks", "/charts", "/components", "/resources"].map((path) => ({
      url: `${HOSTED_DOCS_URL}${path}`,
      changeFrequency: "weekly" as const,
      priority: 0.9,
    })),
    // Every catalogue detail page (a component, a chart, a block, a template), from the index.
    ...CATALOG_INDEX.map((entry) => ({
      url: `${HOSTED_DOCS_URL}${hrefOf(entry)}`,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })),
    { url: `${HOSTED_DOCS_URL}/start`, changeFrequency: "weekly", priority: 0.9 },
    { url: `${HOSTED_DOCS_URL}/agents`, changeFrequency: "weekly", priority: 0.8 },
    { url: `${HOSTED_DOCS_URL}/llms.txt`, changeFrequency: "weekly", priority: 0.8 },
    { url: `${HOSTED_DOCS_URL}/storybook/`, changeFrequency: "weekly", priority: 0.6 },
  ];
}
