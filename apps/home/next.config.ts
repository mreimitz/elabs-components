import type { NextConfig } from "next";
import catalogRedirects from "./content/generated/catalog-redirects.json";

/**
 * The website (ADR 0038). Storybook is its own Vercel project, reached at /storybook/ through a
 * rewrite; set STORYBOOK_ORIGIN=http://localhost:6006 to point it at a local Storybook.
 */
const STORYBOOK_ORIGIN = (process.env.STORYBOOK_ORIGIN ?? "https://storybook.elabs-ai.com").replace(
  /\/+$/,
  "",
);

// Workspace packages export their TypeScript source, so Next compiles them.
const WORKSPACE_PACKAGES = [
  "@elabs-ai/components-ai",
  "@elabs-ai/components-charts",
  "@elabs-ai/components-data",
  "@elabs-ai/components-editor",
  "@elabs-ai/components-flow",
  "@elabs-ai/components-icons",
  "@elabs-ai/components-maps",
  "@elabs-ai/components-marketing",
  "@elabs-ai/components-process",
  "@elabs-ai/components-terminal",
  "@elabs-ai/components-tokens",
  "@elabs-ai/components-ui",
  "@elabs-ai/components-viewer",
];

// Files Storybook's `staticDirs` served at the domain root before the site existed. They stay
// reachable through the Storybook project until the site generates its own; a `fallback`
// rewrite applies only when no site page or public file matches (ADR 0038 §2).
const STORYBOOK_ROOT_FILES = [
  "/llms.txt",
  "/llms/:path*",
  "/robots.txt",
  "/.well-known/mcp.json",
  "/brand-ui-context.md",
  "/component-inventory.md",
];

const config: NextConfig = {
  // No floating Next.js badge over the site while developing; build errors still overlay.
  devIndicators: false,
  transpilePackages: WORKSPACE_PACKAGES,
  images: { unoptimized: true },
  // Storybook loads every asset by a RELATIVE url (./sb-manager/…, ./assets/…), which resolves
  // under /storybook/ only WITH the trailing slash. Next's default 308s /storybook/ to
  // /storybook, the wrong way, so that normalisation is off and `proxy.ts` adds the slash
  // instead: a redirect here would also match /storybook/ and loop (ADR 0038 §2).
  skipTrailingSlashRedirect: true,
  async redirects() {
    return [
      // Every Storybook deep link ever shared is elabs-ai.com/?path=…; the query passes through.
      {
        source: "/",
        has: [{ type: "query", key: "path" }],
        destination: "/storybook/",
        permanent: true,
      },
      { source: "/iframe.html", destination: "/storybook/iframe.html", permanent: true },
      // The 2026-09 catalogue reorganisation: `/charts` became Components → charts, the
      // data-viz block families became `/visualizations`, the `patterns` pseudo-package was
      // dissolved. Every address that existed before still answers (generated, one per page).
      ...catalogRedirects.map((redirect) => ({ ...redirect, permanent: true })),
    ];
  },
  async rewrites() {
    return {
      beforeFiles: [{ source: "/storybook/:path*", destination: `${STORYBOOK_ORIGIN}/:path*` }],
      afterFiles: [],
      fallback: STORYBOOK_ROOT_FILES.map((source) => ({
        source,
        destination: `${STORYBOOK_ORIGIN}${source}`,
      })),
    };
  },
};

export default config;
