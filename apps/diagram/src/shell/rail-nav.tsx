/**
 * DG-22 — the Atlas rail (plan §3.1, item step 2): Home, Workspace (with the folder tree under
 * it), Catalog, Settings. It replaces DG-13/DG-21's sidebar list (`sidebar-nav.tsx`) and DG-04's
 * "Icon packs" group (plan §9 b: the Catalog takes the icons over). Home, Catalog and Settings
 * are links (they navigate); Workspace shows or hides its tree, and on the collapsed icon rail it
 * opens the sidebar first, since the tree only shows expanded.
 */
import { useState } from "react";
import { ChevronRight, FolderTree, House, Settings, Shapes } from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@elabs-ai/components-ui";
import { toHash, useRoute, type Route } from "../routes/use-hash";
import { WorkspaceRootMenu, WorkspaceTree } from "./workspace-tree";

/** The rail's strings, in one place (`conventions/i18n-strings`). */
const RAIL_LABELS = {
  sections: "Atlas",
  home: "Home",
  workspace: "Workspace",
  catalog: "Catalog",
  settings: "Settings",
} as const;

interface RailLinkProps {
  route: Route;
  active: boolean;
  label: string;
  icon: React.ReactNode;
}

/** A link row: `isActive` paints it, `aria-current` names it (wave-1 review M4). */
function RailLink({ route, active, label, icon }: RailLinkProps) {
  const { isMobile, setOpenMobile } = useSidebar();
  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild isActive={active} tooltip={label}>
        <a
          href={toHash(route)}
          aria-current={active ? "page" : undefined}
          onClick={() => isMobile && setOpenMobile(false)}
        >
          {icon}
          <span>{label}</span>
        </a>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

export function RailNav() {
  const route = useRoute();
  const { state, isMobile, setOpen } = useSidebar();
  const [treeOpen, setTreeOpen] = useState(true);

  return (
    <SidebarGroup>
      <SidebarGroupContent>
        <SidebarMenu aria-label={RAIL_LABELS.sections}>
          <RailLink
            route={{ kind: "home" }}
            active={route.kind === "home"}
            label={RAIL_LABELS.home}
            icon={<House aria-hidden="true" />}
          />
          <Collapsible asChild open={treeOpen} onOpenChange={setTreeOpen}>
            <SidebarMenuItem>
              <CollapsibleTrigger asChild>
                <SidebarMenuButton
                  isActive={route.kind === "doc"}
                  tooltip={RAIL_LABELS.workspace}
                  className="[&[data-state=open]>svg:last-child]:rotate-90"
                  onClick={(event) => {
                    // On the icon rail the tree is hidden: open the sidebar onto it instead.
                    if (isMobile || state === "expanded") return;
                    event.preventDefault();
                    setOpen(true);
                    setTreeOpen(true);
                  }}
                >
                  <FolderTree aria-hidden="true" />
                  <span>{RAIL_LABELS.workspace}</span>
                  <ChevronRight
                    aria-hidden="true"
                    className="ms-auto transition-transform duration-fast ease-standard group-data-[collapsible=icon]:hidden"
                  />
                </SidebarMenuButton>
              </CollapsibleTrigger>
              <WorkspaceRootMenu />
              <CollapsibleContent>
                <WorkspaceTree />
              </CollapsibleContent>
            </SidebarMenuItem>
          </Collapsible>
          <RailLink
            route={{ kind: "catalog" }}
            active={route.kind === "catalog"}
            label={RAIL_LABELS.catalog}
            icon={<Shapes aria-hidden="true" />}
          />
          <RailLink
            route={{ kind: "settings" }}
            active={route.kind === "settings"}
            label={RAIL_LABELS.settings}
            icon={<Settings aria-hidden="true" />}
          />
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
