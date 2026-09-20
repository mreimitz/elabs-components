"use client";
/**
 * The catalogue's left navigation, built from the library's Sidebar parts: a filter box, then
 * one collapsible branch per section (Templates, Blocks, Charts) and per package under
 * Components. The branch holding the current page opens itself; the filter opens every branch
 * that still has a match.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { ChevronRight } from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarProvider,
} from "@elabs-ai/components-ui";
import { SearchInput } from "@elabs-ai/components-data";
import { catalogCopy } from "../../content/copy";
import { buildNav, type NavBranch } from "./nav-model";

const copy = catalogCopy.sidebar;
const NAV = buildNav(catalogCopy.sections);

function Branch({
  branch,
  pathname,
  forceOpen,
}: {
  branch: NavBranch;
  pathname: string;
  forceOpen: boolean;
}) {
  const here = pathname === branch.href || pathname.startsWith(`${branch.href}/`);
  const [open, setOpen] = useState(here);
  return (
    <Collapsible open={forceOpen || open} onOpenChange={setOpen} asChild>
      <SidebarMenuItem>
        <SidebarMenuButton asChild isActive={pathname === branch.href}>
          <a href={branch.href}>
            <span className="capitalize">{branch.label}</span>
          </a>
        </SidebarMenuButton>
        <SidebarMenuBadge className="end-8">{branch.count}</SidebarMenuBadge>
        <CollapsibleTrigger
          aria-label={branch.label}
          className="group/trigger absolute end-1 top-1 flex size-6 items-center justify-center rounded-md text-sidebar-foreground hover:bg-sidebar-accent focus-ring"
        >
          <ChevronRight
            aria-hidden="true"
            className="size-4 transition-transform duration-fast ease-standard group-data-[state=open]/trigger:rotate-90"
          />
        </CollapsibleTrigger>
        <CollapsibleContent>
          {branch.groups.map((group) => (
            <SidebarMenuSub key={group.id}>
              {branch.groups.length > 1 ? (
                <li className="px-2 pt-2 text-caption font-semibold text-sidebar-muted-foreground">
                  {group.label}
                </li>
              ) : null}
              {group.leaves.map((item) => (
                <SidebarMenuSubItem key={item.href}>
                  <SidebarMenuSubButton asChild isActive={pathname === item.href}>
                    <a href={item.href}>
                      <span>{item.name}</span>
                    </a>
                  </SidebarMenuSubButton>
                </SidebarMenuSubItem>
              ))}
            </SidebarMenuSub>
          ))}
        </CollapsibleContent>
      </SidebarMenuItem>
    </Collapsible>
  );
}

export function CatalogSidebar() {
  const pathname = usePathname() ?? "";
  const [filter, setFilter] = useState("");
  const needle = filter.trim().toLowerCase();

  const branches = useMemo(() => {
    if (!needle) return NAV;
    return NAV.map((branch) => ({
      ...branch,
      groups: branch.groups
        .map((group) => ({
          ...group,
          leaves: group.leaves.filter(
            (item) =>
              item.name.toLowerCase().includes(needle) ||
              item.summary.toLowerCase().includes(needle) ||
              group.label.toLowerCase().includes(needle),
          ),
        }))
        .filter((group) => group.leaves.length > 0),
    })).filter((branch) => branch.groups.length > 0);
  }, [needle]);

  // Bring the current page's row into view inside the sidebar's own scroll port.
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const active = root.current?.querySelector<HTMLElement>('[data-active="true"]');
    const port = active?.closest<HTMLElement>('[data-sidebar="content"]');
    if (!active || !port) return;
    const top = active.offsetTop - port.clientHeight / 2;
    port.scrollTop = Math.max(0, top);
  }, [pathname]);

  const sections = branches.filter((b) => !b.id.startsWith("components/"));
  const packages = branches.filter((b) => b.id.startsWith("components/"));

  return (
    <SidebarProvider ref={root} className="h-full min-h-0">
      <Sidebar collapsible="none" className="h-full w-full border-e border-sidebar-border">
        <SidebarHeader>
          <SearchInput
            value={filter}
            onValueChange={setFilter}
            label={copy.filter}
            placeholder={copy.filterPlaceholder}
          />
        </SidebarHeader>
        <SidebarContent>
          {branches.length === 0 ? (
            <p className="px-4 py-2 text-meta text-sidebar-muted-foreground">{copy.empty}</p>
          ) : null}
          {sections.length > 0 ? (
            <SidebarGroup>
              <SidebarGroupContent>
                <SidebarMenu>
                  {sections.map((branch) => (
                    <Branch
                      key={branch.id}
                      branch={branch}
                      pathname={pathname}
                      forceOpen={needle.length > 0}
                    />
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          ) : null}
          {packages.length > 0 ? (
            <SidebarGroup>
              <SidebarGroupLabel asChild>
                <a href="/components">{catalogCopy.sections.components}</a>
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {packages.map((branch) => (
                    <Branch
                      key={branch.id}
                      branch={branch}
                      pathname={pathname}
                      forceOpen={needle.length > 0}
                    />
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          ) : null}
        </SidebarContent>
      </Sidebar>
    </SidebarProvider>
  );
}
