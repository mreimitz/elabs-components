"use client";
/**
 * Root providers for an enterprise brand-ui app (baseline root wiring).
 * Order: Theme -> Tooltip -> Sidebar -> app; <Toaster/> mounted once.
 * Generalized from a shipping workbench app's providers + the brand-ui baseline.
 * Verified against @elabs-ai/components-* v1.0.0 source. NOTE: the ContextPanel family is in
 * @elabs-ai/components-ai (not @elabs-ai/components-ui) and is AI-oriented — add <ContextPanelProvider> from
 * @elabs-ai/components-ai only for AI workspaces; generic detail uses a right Sheet/Drawer.
 */
import "@elabs-ai/components-tokens/styles.css";
import { ThemeProvider } from "@elabs-ai/components-tokens";
import { SidebarProvider, Toaster, TooltipProvider } from "@elabs-ai/components-ui";
import type { ReactNode } from "react";

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider defaultTheme="light">
      <TooltipProvider delayDuration={300}>
        {/* AI workspaces also wrap children in <ContextPanelProvider> from @elabs-ai/components-ai. */}
        <SidebarProvider>{children}</SidebarProvider>
      </TooltipProvider>
      <Toaster />
    </ThemeProvider>
  );
}
