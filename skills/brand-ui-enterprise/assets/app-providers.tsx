"use client";
/**
 * Root providers for an enterprise brand-ui app (baseline root wiring).
 * Order: Theme -> Tooltip -> Sidebar -> app; <Toaster/> mounted once.
 * Generalized from qlabs-workbench app-providers + the brand-ui baseline.
 * Verified against @qlik-coe-emea/qlabs-components-* v1.0.0 source. NOTE: the ContextPanel family is in
 * @qlik-coe-emea/qlabs-components-ai (not @qlik-coe-emea/qlabs-components-ui) and is AI-oriented — add <ContextPanelProvider> from
 * @qlik-coe-emea/qlabs-components-ai only for AI workspaces; generic detail uses a right Sheet/Drawer.
 */
import "@qlik-coe-emea/qlabs-components-tokens/styles.css";
import { ThemeProvider } from "@qlik-coe-emea/qlabs-components-tokens";
import { SidebarProvider, Toaster, TooltipProvider } from "@qlik-coe-emea/qlabs-components-ui";
import type { ReactNode } from "react";

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider defaultTheme="qlik-bright">
      <TooltipProvider delayDuration={300}>
        {/* AI workspaces also wrap children in <ContextPanelProvider> from @qlik-coe-emea/qlabs-components-ai. */}
        <SidebarProvider>{children}</SidebarProvider>
      </TooltipProvider>
      <Toaster />
    </ThemeProvider>
  );
}
