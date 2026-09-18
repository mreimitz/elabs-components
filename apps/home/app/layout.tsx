import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Analytics } from "@vercel/analytics/next";
import { siteThemeInitScript } from "../lib/theme-state";
import { SiteThemeProvider } from "../lib/use-theme-transition";
import "./globals.css";

export const metadata: Metadata = {
  title: "brand-ui",
  description:
    "brand-ui — a source-owned, token-driven React component system, legible to coding agents through a CLI and a hosted MCP server.",
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
      </head>
      <body className="bg-background text-foreground">
        <SiteThemeProvider>{children}</SiteThemeProvider>
        <Analytics />
      </body>
    </html>
  );
}
