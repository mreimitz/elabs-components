import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Analytics } from "@vercel/analytics/next";
import { HOSTED_DOCS_URL } from "@elabs-ai/components-cli/lib/render-docs.mjs";
import { siteThemeInitScript } from "../lib/theme-state";
import { SiteThemeProvider } from "../lib/use-theme-transition";
import { SiteShell } from "../components/blocks/app-shell/site-shell";
import { AGENT_HOSTS } from "../lib/agent-hosts";
import { cli } from "../lib/content";
import { shellCopy } from "../content/copy";
import "./globals.css";

const OG_IMAGE = "/opengraph-image?theme=default";

export const metadata: Metadata = {
  metadataBase: new URL(HOSTED_DOCS_URL),
  title: { default: shellCopy.titleDefault, template: `${shellCopy.wordmark} — %s` },
  description: shellCopy.positioning,
  alternates: { canonical: "/" },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "32x32" },
      { url: "/brand-favicon.svg", type: "image/svg+xml" },
    ],
    shortcut: "/favicon.ico",
  },
  openGraph: {
    title: shellCopy.titleDefault,
    description: shellCopy.positioning,
    url: "/",
    siteName: shellCopy.wordmark,
    type: "website",
    images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: shellCopy.titleDefault }],
  },
  twitter: {
    card: "summary_large_image",
    title: shellCopy.titleDefault,
    description: shellCopy.positioning,
    images: [OG_IMAGE],
  },
};

// Runs before first paint (RM-091): applies `?theme=`/`?mode=`, else the persisted theme, else the
// OS colour scheme, so no visitor sees a flash of the default. A plain <script> in <head> runs
// while the HTML parses; `next/script` beforeInteractive would run only once Next's runtime loads.
const THEME_INIT = siteThemeInitScript();

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script id="theme-init">{THEME_INIT}</script>
        {/* The agent surface (concept §6, RM-093): discoverable straight from the raw HTML. */}
        <link rel="alternate" type="text/plain" href="/llms.txt" title={shellCopy.footer.llmsTxt} />
        <link rel="alternate" type="application/json" href="/.well-known/mcp.json" />
      </head>
      <body className="bg-background text-foreground">
        <SiteThemeProvider>
          {/* The frame is the registry's flagship app shell: nav rail, top bar, summoned dock.
              Its `<main>` is the one landmark and the scroll container, so routes render plain
              `<div>` roots. */}
          <SiteShell hosts={AGENT_HOSTS} routine={cli.routine}>
            {children}
          </SiteShell>
        </SiteThemeProvider>
        <Analytics />
      </body>
    </html>
  );
}
