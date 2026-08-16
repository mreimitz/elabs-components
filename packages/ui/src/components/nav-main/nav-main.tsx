/**
 * Shared collapsible sidebar navigation primitive (issue #99).
 * Promoted from `packages/ui/src/blocks/sidebar-02/nav-main.tsx`.
 *
 * Renders a `SidebarMenu` of routes; each route with sub-items uses a
 * `Collapsible` expand/collapse affordance. Collapses icon-only when the
 * sidebar is in the `"collapsed"` state.
 */
"use client";

import type React from "react";
import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "../collapsible";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  useSidebar,
} from "../sidebar";
import { cn } from "../../lib/cn";

export type NavMainSubItem = {
  title: string;
  link: string;
  icon?: React.ReactNode;
};

export type NavMainRoute = {
  id: string;
  title: string;
  icon?: React.ReactNode;
  link: string;
  subs?: NavMainSubItem[];
};

export interface NavMainProps {
  routes: NavMainRoute[];
  className?: string;
}

/**
 * Collapsible primary navigation list for sidebars.
 *
 * - Routes with `subs` render as an expandable group (one open at a time).
 * - Routes without `subs` render as a simple link button.
 * - Collapses to icon-only when the enclosing `Sidebar` is in `"collapsed"` state.
 *
 * @example
 * ```tsx
 * <NavMain routes={[
 *   { id: "home", title: "Home", icon: <Home />, link: "#" },
 *   { id: "settings", title: "Settings", icon: <Settings />, link: "#",
 *     subs: [{ title: "General", link: "#" }] },
 * ]} />
 * ```
 */
export function NavMain({ routes, className }: NavMainProps) {
  const { state } = useSidebar();
  const isCollapsed = state === "collapsed";
  const [openCollapsible, setOpenCollapsible] = useState<string | null>(null);

  return (
    <SidebarMenu className={className}>
      {routes.map((route) => {
        const isOpen = !isCollapsed && openCollapsible === route.id;
        const hasSubRoutes = !!route.subs?.length;

        return (
          <SidebarMenuItem key={route.id}>
            {hasSubRoutes ? (
              <Collapsible
                open={isOpen}
                onOpenChange={(open) => setOpenCollapsible(open ? route.id : null)}
                className="w-full"
              >
                <CollapsibleTrigger asChild>
                  <SidebarMenuButton
                    tooltip={route.title}
                    className={cn(
                      "flex w-full items-center rounded-lg px-2 transition-colors",
                      isOpen
                        ? "bg-sidebar-accent text-sidebar-accent-foreground"
                        : "text-sidebar-muted-foreground",
                      isCollapsed && "justify-center",
                    )}
                  >
                    {route.icon}
                    {!isCollapsed && (
                      <span className="ms-2 flex-1 text-sm font-medium">{route.title}</span>
                    )}
                    {!isCollapsed && (
                      <span className="ms-auto">
                        {isOpen ? (
                          <ChevronUp className="size-4" />
                        ) : (
                          <ChevronDown className="size-4" />
                        )}
                      </span>
                    )}
                  </SidebarMenuButton>
                </CollapsibleTrigger>
                {!isCollapsed && (
                  <CollapsibleContent>
                    <SidebarMenuSub className="my-1 ms-3.5">
                      {route.subs?.map((subRoute) => (
                        <SidebarMenuSubItem
                          key={`${route.id}-${subRoute.title}`}
                          className="h-auto"
                        >
                          <SidebarMenuSubButton asChild>
                            <a
                              href={subRoute.link}
                              className="flex items-center rounded-md px-4 py-1.5 text-sm font-medium text-sidebar-muted-foreground"
                            >
                              {subRoute.title}
                            </a>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                      ))}
                    </SidebarMenuSub>
                  </CollapsibleContent>
                )}
              </Collapsible>
            ) : (
              <SidebarMenuButton tooltip={route.title} asChild>
                <a
                  href={route.link}
                  className={cn(
                    "flex items-center rounded-lg px-2 text-sidebar-muted-foreground",
                    isCollapsed && "justify-center",
                  )}
                >
                  {route.icon}
                  {!isCollapsed && <span className="ms-2 text-sm font-medium">{route.title}</span>}
                </a>
              </SidebarMenuButton>
            )}
          </SidebarMenuItem>
        );
      })}
    </SidebarMenu>
  );
}
