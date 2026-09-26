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
  /**
   * The current YAML source, forwarded to the top bar's character-count
   * chip. The item's own shell snippet renders a bare `<TopBar />`, which
   * cannot see `App`'s `text` state — this prop threads it through without
   * widening `TopBar`'s own contract. Not a library gap, an app-internal
   * wiring choice: goes away once DG-12 moves diagram state into the shared
   * store and `TopBar` reads the count from there directly.
   */
  text?: string;
}

/**
 * The dashboard app shell frame (plan §6) — sidebar (examples, icon packs,
 * signed-in user) + top bar + the editor/canvas split `App` renders as
 * `children`. Structure copied from `packages/charts/src/templates-dashboard.stories.tsx`
 * (the canonical dashboard template).
 */
/** Target of the skip link: the editor/canvas split (or whichever dev route replaces it). */
const WORKSPACE_ID = "diagram-workspace";

export function DiagramShell({ children, text = "" }: DiagramShellProps) {
  return (
    <SidebarProvider>
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
        Skip to diagram
      </SkipLink>
      {/* P4: library gap — Sidebar renders plain divs, no landmark (axe `region`); the
          navigation role goes on its container, which receives the spread props. */}
      <Sidebar collapsible="icon" role="navigation" aria-label="Diagram">
        {/* `h-header` so the brand row shares the top bar's band (wave-0 review m7). */}
        <SidebarHeader className="h-header justify-center px-3">
          <div className="flex items-center gap-2">
            <AppIcon height={20} aria-hidden />
            <span className="truncate font-semibold group-data-[collapsible=icon]:hidden">
              Diagram
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
        <TopBar text={text} />
        <div id={WORKSPACE_ID} tabIndex={-1} className="flex min-h-0 flex-1 focus-ring-inset">
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
