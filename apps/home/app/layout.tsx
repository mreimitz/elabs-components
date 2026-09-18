import type { Metadata } from "next";
import Script from "next/script";
import type { ReactNode } from "react";
import { Analytics } from "@vercel/analytics/next";
import { ThemeProvider } from "@elabs-ai/components-tokens";
import "./globals.css";

export const metadata: Metadata = {
  title: "brand-ui",
  description:
    "brand-ui — a source-owned, token-driven React component system, legible to coding agents through a CLI and a hosted MCP server.",
};

// Runs before first paint: applies the persisted theme (ThemeProvider's default storage key) so
// a returning dark-theme visitor never sees a light flash. ThemeProvider owns it after hydration.
const THEME_INIT = `try{var t=localStorage.getItem("brand-ui-theme");if(t)document.documentElement.setAttribute("data-theme",t)}catch(e){}`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="bg-background text-foreground">
        <Script id="theme-init" strategy="beforeInteractive">
          {THEME_INIT}
        </Script>
        <ThemeProvider>{children}</ThemeProvider>
        <Analytics />
      </body>
    </html>
  );
}
