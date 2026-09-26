import type { ReactNode } from "react";
import { AppIcon } from "@elabs-ai/components-icons";
import {
  NavUser,
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarProvider,
  SkipLink,
} from "@elabs-ai/components-ui";
import { SidebarNav } from "./sidebar-nav";
import { TopBar } from "./top-bar";

export interface DiagramShellProps {
  children: ReactNode;
}

/**
 * The dashboard app shell frame (plan §6) — sidebar (examples, icon packs,
 * signed-in user) + top bar + the editor/canvas split `App` renders as
 * `children`. Structure copied from `packages/charts/src/templates-dashboard.stories.tsx`
 * (the canonical dashboard template).
 */
/** Target of the skip link: the editor/canvas split (or whichever dev route replaces it). */
const WORKSPACE_ID = "diagram-workspace";

/** The shell's strings, in one place (`conventions/i18n-strings`). */
const SHELL_LABELS = {
  skipLink: "Skip to diagram",
  navigation: "Diagram",
  appName: "Diagram",
} as const;

export function DiagramShell({ children }: DiagramShellProps) {
  return (
    // Starts on the icon rail (wave-2 review M1): the expanded sidebar costs the canvas 208 px,
    // which the review measured as 0.479 → 0.424 fit zoom on Lakehouse at 1920. The trigger
    // or Ctrl/⌘+B opens it; the rail's tooltips name each entry (sidebar-nav.tsx).
    // P4: library gap — SidebarProvider writes a `sidebar_state` cookie but never reads it
    // back, so an opened sidebar does not survive a reload; the app builds no persistence
    // of its own (docs/findings/DG-02-shell-a11y.md, wave-2 additions).
    <SidebarProvider defaultOpen={false}>
      {/*
       * The app routes on `location.hash` (`#icons`, `#edges`, …), so the skip link's own
       * `href="#diagram-workspace"` would navigate away from the current route: focus the
       * target directly instead. P4: library gap — SkipLink assumes hash navigation is free.
       */}
      <SkipLink
        targetId={WORKSPACE_ID}
        onClick={(event) => {
          event.preventDefault();
          document.getElementById(WORKSPACE_ID)?.focus();
        }}
      >
        {SHELL_LABELS.skipLink}
      </SkipLink>
      {/* P4: library gap — Sidebar renders plain divs, no landmark (axe `region`); the
          navigation role goes on its container, which receives the spread props. */}
      <Sidebar collapsible="icon" role="navigation" aria-label={SHELL_LABELS.navigation}>
        {/* `h-header` so the brand row shares the top bar's band (wave-0 review m7). */}
        <SidebarHeader className="h-header justify-center px-3">
          <div className="flex items-center gap-2">
            <AppIcon height={20} aria-hidden />
            <span className="truncate font-semibold group-data-[collapsible=icon]:hidden">
              {SHELL_LABELS.appName}
            </span>
          </div>
        </SidebarHeader>
        <SidebarContent>
          <SidebarNav />
        </SidebarContent>
        <SidebarFooter>
          <NavUser user={{ name: "Avery Rao", email: "avery@example.com" }} />
        </SidebarFooter>
      </Sidebar>
      {/* `h-svh`: a definite height, so the editor/canvas split fills the viewport instead of
          growing the page past it (min-height alone lets content push it 8 px taller). */}
      <SidebarInset className="h-svh">
        <TopBar />
        <div id={WORKSPACE_ID} tabIndex={-1} className="flex min-h-0 flex-1 focus-ring-inset">
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
