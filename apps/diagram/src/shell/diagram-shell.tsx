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
export function DiagramShell({ children, text = "" }: DiagramShellProps) {
  return (
    <SidebarProvider>
      <Sidebar collapsible="icon">
        <SidebarHeader className="px-3 py-2">
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
      <SidebarInset>
        <TopBar text={text} />
        <div className="flex min-h-0 flex-1">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}
