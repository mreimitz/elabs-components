"use client";
/**
 * Root providers for an enterprise brand-ui app (baseline root wiring).
 * Order: Theme -> Tooltip -> Sidebar -> app; <Toaster/> mounted once.
 * Generalized from a shipping workbench app's providers + the brand-ui baseline.
 * Verified against @elabs/components-* v1.0.0 source. NOTE: the ContextPanel family is in
 * @elabs/components-ai (not @elabs/components-ui) and is AI-oriented — add <ContextPanelProvider> from
 * @elabs/components-ai only for AI workspaces; generic detail uses a right Sheet/Drawer.
 */
import "@elabs/components-tokens/styles.css";
import { ThemeProvider } from "@elabs/components-tokens";
import { SidebarProvider, Toaster, TooltipProvider } from "@elabs/components-ui";
import type { ReactNode } from "react";

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider defaultTheme="light">
      <TooltipProvider delayDuration={300}>
        {/* AI workspaces also wrap children in <ContextPanelProvider> from @elabs/components-ai. */}
        <SidebarProvider>{children}</SidebarProvider>
      </TooltipProvider>
      <Toaster />
    </ThemeProvider>
  );
}
